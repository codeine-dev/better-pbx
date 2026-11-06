#!/usr/bin/env node
// Container healthcheck. A container is healthy only when all three supervised processes are
// answering: the local API, the Asterisk control socket, and fail2ban.
import { execFileSync } from 'node:child_process';

const port = process.env.PBX_API_PORT ?? '8080';
const apiUrl = `http://127.0.0.1:${port}/api/health`;

function fail(message) {
  console.error(`better-pbx healthcheck failed: ${message}`);
  process.exit(1);
}

try {
  const response = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) {
    fail(`health endpoint returned ${response.status}`);
  }
} catch (error) {
  fail(`API is not reachable: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const version = execFileSync('/usr/sbin/asterisk', ['-rx', 'core show version'], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!/Asterisk 22\./.test(version)) {
    fail(`unexpected Asterisk version: ${version.trim().split('\n')[0] ?? 'no output'}`);
  }
} catch (error) {
  fail(`Asterisk is not responding: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const status = execFileSync('/usr/bin/fail2ban-client', ['status'], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!status.includes('better-pbx')) {
    fail('fail2ban is running but the better-pbx jail is not active');
  }
} catch (error) {
  fail(`fail2ban is not responding: ${error instanceof Error ? error.message : String(error)}`);
}

process.exit(0);
