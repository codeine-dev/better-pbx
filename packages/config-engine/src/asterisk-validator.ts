import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import type { RenderedTree } from './render/types.js';

/**
 * A throwaway Asterisk validator. It materialises a rendered tree in a temporary directory and
 * starts a real Asterisk 22 from the appliance image on alternate SIP/RTP ports. Nothing touches
 * the operator's /data, and the container is removed afterwards.
 *
 * This module is intentionally separate from the pure renderers: it is the only place in the
 * config engine that touches the filesystem or spawns processes.
 */

export interface AsteriskValidationOptions {
  /** Docker image containing Asterisk 22 and the appliance module set. */
  image?: string;
  /** Docker binary. */
  docker?: string;
  /** Parent for throwaway data. Defaults to /tmp/opencode (or os.tmpdir as a fallback). */
  tempRoot?: string;
  sipPort?: number;
  tlsPort?: number;
  rtpStart?: number;
  rtpEnd?: number;
  /** Milliseconds to wait for Asterisk to become available. */
  timeoutMs?: number;
  /** Keep the temporary tree for debugging (returned in the report). */
  keepTemp?: boolean;
}

export interface AsteriskValidationReport {
  status: 'ok' | 'unavailable' | 'failed';
  /** Exact command a human can run to reproduce the check. */
  command: string;
  reason?: string;
  log?: string;
  endpoints?: string[];
  dialplan?: string[];
  tempDir?: string;
}

const DEFAULT_IMAGE = 'better-pbx:dev';
const SPOOL_DIRS = [
  'dictate',
  'meetme',
  'monitor',
  'outgoing',
  'outgoing_done',
  'qlog',
  'recording',
  'system',
  'tmp',
];

function run(
  command: string,
  args: string[],
  options: { timeout?: number; input?: string } = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: options.timeout ?? 60_000,
    input: options.input,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function makeTreeWritable(root: string): void {
  const entries: Array<[string, boolean]> = [[root, true]];
  while (entries.length > 0) {
    const [path, isDir] = entries.pop()!;
    chmodSync(path, 0o777);
    if (!isDir) continue;
    for (const entry of readdirSync(path)) {
      const full = join(path, entry);
      entries.push([full, statSync(full).isDirectory()]);
    }
  }
}

function rewritePorts(
  content: string,
  ports: { sipPort: number; tlsPort: number; rtpStart: number; rtpEnd: number },
): string {
  return content
    .replace(/bind = 0\.0\.0\.0:\d+/g, (match) => {
      // The first transport-bind is UDP, the second is TLS.
      const isTls = match.includes(':5061') || match.includes(String(ports.tlsPort));
      return `bind = 0.0.0.0:${isTls ? ports.tlsPort : ports.sipPort}`;
    })
    .replace(/rtpstart = \d+/g, `rtpstart = ${ports.rtpStart}`)
    .replace(/rtpend = \d+/g, `rtpend = ${ports.rtpEnd}`);
}

function sectionNames(pjsip: string): string[] {
  const names: string[] = [];
  for (const line of pjsip.split('\n')) {
    const match = /^\[([^\]]+)\]$/.exec(line.trim());
    if (match?.[1] === undefined) continue;
    const name = match[1];
    if (name.startsWith('endpoint-') || name.startsWith('trunk-')) {
      if (
        name.startsWith('trunk-aor-') ||
        name.startsWith('trunk-auth-') ||
        name.startsWith('trunk-reg-') ||
        name.startsWith('trunk-identify-')
      ) {
        continue;
      }
      names.push(name);
    }
  }
  return names;
}

function internalPatterns(extensionsConf: string): string[] {
  const patterns: string[] = [];
  let inInternal = false;
  for (const line of extensionsConf.split('\n')) {
    if (/^\[internal\]$/.test(line.trim())) {
      inInternal = true;
      continue;
    }
    if (inInternal && /^\[/.test(line.trim())) break;
    if (!inInternal) continue;
    const match = /^\s*exten\s*=>\s*([^,]+),1,/.exec(line);
    if (match?.[1] === undefined) continue;
    const target = match[1].trim();
    if (['s', 'i', 't', 'h'].includes(target)) continue;
    patterns.push(target);
  }
  return patterns;
}

function readLog(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/**
 * Validate a rendered tree against a real Asterisk instance. Returns `unavailable` (not a failure)
 * when Docker, the image, or openssl is missing, so CI without Docker can still run the pure tests.
 */
export async function validateConfigWithAsterisk(
  tree: RenderedTree,
  options: AsteriskValidationOptions = {},
): Promise<AsteriskValidationReport> {
  const image = options.image ?? process.env.BETTER_PBX_IMAGE ?? DEFAULT_IMAGE;
  const docker = options.docker ?? 'docker';
  const ports = {
    sipPort: options.sipPort ?? 15060,
    tlsPort: options.tlsPort ?? 15061,
    rtpStart: options.rtpStart ?? 20000,
    rtpEnd: options.rtpEnd ?? 20100,
  };
  const timeoutMs = options.timeoutMs ?? 30_000;
  const command = `docker run --rm --network=none -v <temp>/etc:/etc/asterisk:ro -v <temp>/data:/data -v <temp>/run:/run/asterisk --entrypoint sh ${image} -c 'asterisk -C /etc/asterisk/asterisk.conf; sleep 60'`;

  if (process.env.PBX_SKIP_ASTERISK_VALIDATION === '1') {
    return { status: 'unavailable', command, reason: 'PBX_SKIP_ASTERISK_VALIDATION=1' };
  }

  const dockerVersion = run(docker, ['version', '--format', '{{.Server.Version}}'], { timeout: 10_000 });
  if (dockerVersion.status !== 0) {
    return { status: 'unavailable', command, reason: 'docker daemon is unavailable' };
  }
  const imageInspect = run(docker, ['image', 'inspect', image], { timeout: 10_000 });
  if (imageInspect.status !== 0) {
    return { status: 'unavailable', command, reason: `image ${image} is not built` };
  }
  const openssl = run('openssl', ['version'], { timeout: 10_000 });
  if (openssl.status !== 0) {
    return { status: 'unavailable', command, reason: 'openssl is unavailable' };
  }

  const root = options.tempRoot ?? (existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir());
  mkdirSync(root, { recursive: true });
  const temp = mkdtempSync(join(root, 'pbx-validator-'));
  const etc = join(temp, 'etc');
  const data = join(temp, 'data');
  const runDir = join(temp, 'run');
  const f2b = join(temp, 'fail2ban');
  const containerName = `pbx-validator-${process.pid}-${Date.now()}`;

  try {
    mkdirSync(etc, { recursive: true });
    mkdirSync(join(data, 'log', 'cdr-csv'), { recursive: true });
    mkdirSync(join(data, 'voicemail'), { recursive: true });
    mkdirSync(join(data, 'runtime', 'tls'), { recursive: true });
    mkdirSync(join(data, 'sounds'), { recursive: true });
    mkdirSync(join(data, 'fail2ban'), { recursive: true });
    for (const spool of SPOOL_DIRS) mkdirSync(join(data, spool), { recursive: true });
    mkdirSync(runDir, { recursive: true });
    for (const dir of ['action.d', 'fail2ban.d', 'filter.d', 'jail.d']) {
      mkdirSync(join(f2b, dir), { recursive: true });
    }

    for (const [key, content] of Object.entries(tree.files)) {
      if (key.startsWith('asterisk/')) {
        const file = join(etc, basename(key));
        writeFileSync(file, rewritePorts(content, ports), 'utf8');
      } else if (key.startsWith('fail2ban/')) {
        writeFileSync(join(f2b, key.slice('fail2ban/'.length)), content, 'utf8');
      }
    }
    for (const [key, content] of Object.entries(tree.runtimeFiles)) {
      const relative = key.replace(/^\/data\//, '');
      const file = join(data, relative);
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, content, 'utf8');
    }

    execFileSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
        '-keyout', join(data, 'runtime', 'tls', 'sip.key'),
        '-out', join(data, 'runtime', 'tls', 'sip.crt'),
        '-subj', '/CN=pbx-validator',
      ],
      { stdio: 'ignore' },
    );
    for (const logfile of ['messages', 'security', 'queue_log']) {
      writeFileSync(join(data, 'log', logfile), '', 'utf8');
    }

    makeTreeWritable(temp);

    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
    const gid = typeof process.getgid === 'function' ? process.getgid() : undefined;
    const userArgs = uid !== undefined && gid !== undefined ? ['--user', `${uid}:${gid}`] : [];

    const started = run(
      docker,
      [
        'run', '-d', '--name', containerName, '--network=none', ...userArgs,
        '-v', `${etc}:/etc/asterisk:ro`,
        '-v', `${data}:/data`,
        '-v', `${runDir}:/run/asterisk`,
        '-v', `${f2b}/jail.d/better-pbx.local:/etc/fail2ban/jail.d/better-pbx.local:ro`,
        '-v', `${f2b}/filter.d/asterisk-security.conf:/etc/fail2ban/filter.d/asterisk-security.conf:ro`,
        '-v', `${f2b}/action.d/pbx-ban.conf:/etc/fail2ban/action.d/pbx-ban.conf:ro`,
        '-v', `${f2b}/fail2ban.d/better-pbx.local:/etc/fail2ban/fail2ban.d/better-pbx.local:ro`,
        '--entrypoint', 'sh', image,
        '-c', 'asterisk -C /etc/asterisk/asterisk.conf; sleep 120',
      ],
      { timeout: 30_000 },
    );
    if (started.status !== 0) {
      return { status: 'failed', command, reason: `failed to start container: ${started.stderr}` };
    }

    let ready = false;
    const attempts = Math.max(1, Math.ceil(timeoutMs / 1000));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const probe = run(docker, ['exec', containerName, 'asterisk', '-rx', 'core show version'], {
        timeout: 5000,
      });
      if (probe.status === 0 && probe.stdout.includes('Asterisk')) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const log = [
      run(docker, ['logs', containerName]).stdout,
      readLog(join(data, 'log', 'messages')),
      readLog(join(data, 'log', 'security')),
    ].join('\n');

    if (!ready) {
      return { status: 'failed', command, reason: 'Asterisk did not become ready', log };
    }

    const errorLines = log
      .split('\n')
      .filter((line) => /ERROR\[|WARNING\[/.test(line));
    if (errorLines.length > 0) {
      return {
        status: 'failed',
        command,
        reason: `Asterisk reported errors/warnings: ${errorLines.join(' | ')}`,
        log,
      };
    }

    const endpointsOutput = run(
      docker,
      ['exec', containerName, 'asterisk', '-rx', 'pjsip show endpoints'],
      { timeout: 10_000 },
    ).stdout;
    const dialplanOutput = run(
      docker,
      ['exec', containerName, 'asterisk', '-rx', 'dialplan show internal'],
      { timeout: 10_000 },
    ).stdout;

    const expectedEndpoints = sectionNames(tree.files['asterisk/pjsip.conf'] ?? '');
    const missingEndpoints = expectedEndpoints.filter((name) => !endpointsOutput.includes(name));
    if (missingEndpoints.length > 0) {
      return {
        status: 'failed',
        command,
        reason: `missing PJSIP endpoints: ${missingEndpoints.join(', ')}`,
        log,
      };
    }

    const expectedPatterns = internalPatterns(tree.files['asterisk/extensions.conf'] ?? '');
    const missingPatterns = expectedPatterns.filter((pattern) => !dialplanOutput.includes(pattern));
    if (missingPatterns.length > 0) {
      return {
        status: 'failed',
        command,
        reason: `missing dialplan entries: ${missingPatterns.join(', ')}`,
        log,
      };
    }

    const fail2banTest = run(
      docker,
      ['exec', containerName, 'fail2ban-client', '-t'],
      { timeout: 10_000 },
    );
    if (fail2banTest.status !== 0) {
      return {
        status: 'failed',
        command,
        reason: `fail2ban config test failed: ${fail2banTest.stdout} ${fail2banTest.stderr}`.trim(),
        log,
      };
    }

    return {
      status: 'ok',
      command,
      log,
      endpoints: expectedEndpoints,
      dialplan: expectedPatterns,
      ...(options.keepTemp ? { tempDir: temp } : {}),
    };
  } catch (error) {
    return {
      status: 'failed',
      command,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    run(docker, ['rm', '-f', containerName], { timeout: 10_000 });
    if (!options.keepTemp) rmSync(temp, { recursive: true, force: true });
  }
}
