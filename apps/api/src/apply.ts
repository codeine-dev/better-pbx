import { renderSecure, type RenderedTree } from '@better-pbx/config-engine';
import type { PbxModel } from '@better-pbx/shared';
import { assertValidModel } from '@better-pbx/config-engine';
import { dump } from 'js-yaml';
import type { CommandResult } from './cli.js';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { ApiConfig } from './config.js';
import type { GitManager } from './git-manager.js';
import type { AsteriskCli, Fail2banCli } from './cli.js';
import { recordAudit } from './audit.js';
import type { DatabaseSync } from 'node:sqlite';

export interface ApplyOptions {
  config: ApiConfig;
  db: DatabaseSync;
  git: GitManager;
  asterisk: AsteriskCli;
  fail2ban: Fail2banCli;
  actor: string;
  changeDescription: string;
  runtimeBans?: Array<{ ip: string }>;
  securityPolicy?: Record<string, unknown>;
}

export interface ApplyResult {
  commitSha: string;
  restartRequired: boolean;
  applied: boolean;
}

// simple per-config mutex
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let resolveLock!: () => void;
  const next = new Promise<void>((res) => (resolveLock = res));
  locks.set(key, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    resolveLock();
    if (locks.get(key) === next) locks.delete(key);
  }
}

function restartRequiredFor(prev: PbxModel | null, next: PbxModel): boolean {
  if (!prev) return true;
  if (JSON.stringify(prev.settings.network) !== JSON.stringify(next.settings.network)) return true;
  if (JSON.stringify(prev.settings.security) !== JSON.stringify(next.settings.security)) return false;
  return false;
}

function writeFileTree(config: ApiConfig, tree: RenderedTree): void {
  // write model separately by caller; here write rendered files
  for (const [relPath, content] of Object.entries(tree.files)) {
    const full = join(config.configDir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  for (const [fullPath, content] of Object.entries(tree.runtimeFiles)) {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
}

function snapshotFiles(config: ApiConfig): Map<string, string> {
  const map = new Map<string, string>();
  // snapshot all files under configDir
  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (name === '.git') continue;
        walk(full);
      } else {
        map.set(relative(config.configDir, full), readFileSync(full, 'utf8'));
      }
    }
  }
  walk(config.configDir);
  return map;
}

function restoreFiles(config: ApiConfig, snapshot: Map<string, string>): void {
  // remove all files under configDir except .git, then restore
  function clear(dir: string) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name === '.git') continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) clear(full);
      rmSync(full, { recursive: true, force: true });
    }
  }
  clear(config.configDir);
  for (const [rel, content] of snapshot.entries()) {
    const full = join(config.configDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
}

export async function applyModel(
  newModelRaw: unknown,
  opts: ApplyOptions,
  prevModel: PbxModel | null,
): Promise<ApplyResult> {
  const config = opts.config;
  return withLock(config.configDir, async () => {
    ensureDirs(config);
    const model = assertValidModel(newModelRaw, opts.securityPolicy ?? {});
    const tree = renderSecure({
      model,
      options: { paths: { dataDir: config.dataDir, etcDir: '/etc/asterisk', logDir: join(config.dataDir, 'log'), runDir: '/run/asterisk' } },
      runtime: { bannedCidrs: (opts.runtimeBans ?? []).map((b) => b.ip) },
    });

    const beforeSnapshot = snapshotFiles(config);

    // write model yaml
    const modelYaml = dump(model, { lineWidth: 120, noRefs: true });
    mkdirSync(dirname(config.modelPath), { recursive: true });

    const restartRequired = restartRequiredFor(prevModel, model);

    try {
      // atomic write: write model + rendered
      writeFileSync(config.modelPath, modelYaml, 'utf8');
      writeFileTree(config, tree);

      // reloads
      const reloads: Array<() => CommandResult> = [
        () => opts.asterisk.reloadDialplan(),
        () => opts.asterisk.reloadPjsip(),
        () => opts.asterisk.reloadVoicemail(),
        () => opts.asterisk.reloadQueues(),
        () => opts.asterisk.loggerReload(),
      ];
      for (const r of reloads) {
        const res = r();
        if (res.status !== 0) {
          throw new Error(`reload failed: ${res.stderr || res.stdout}`);
        }
      }
      // fail2ban reload best-effort
      try {
        opts.fail2ban.reload();
      } catch {
        // ignore
      }

      // commit
      const sha = opts.git.commitAll(
        `${opts.changeDescription}`,
        'BetterPBX Admin',
        'admin@better-pbx.local',
      );
      // update model updatedAt? already in model

      recordAudit(opts.db, {
        actor: opts.actor,
        action: 'apply',
        target: 'model',
        commitSha: sha,
        details: { changeDescription: opts.changeDescription, restartRequired },
      });

      return { commitSha: sha, restartRequired, applied: true };
    } catch (err) {
      // rollback files
      restoreFiles(config, beforeSnapshot);
      // if git had previous sha, restore model from it? files restored includes model if snapshot captured
      throw err;
    }
  });
}

function ensureDirs(config: ApiConfig): void {
  mkdirSync(config.configDir, { recursive: true });
  mkdirSync(config.runtimeDir, { recursive: true });
}

