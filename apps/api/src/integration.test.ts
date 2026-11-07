import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const tempDirs: string[] = [];

function makeDataDir(): { dataDir: string; tokenPath: string } {
  const dataDir = mkdtempSync(join(tmpdir(), 'better-pbx-int-'));
  tempDirs.push(dataDir);
  const tokenPath = join(dataDir, 'setup-token');
  writeFileSync(tokenPath, 'SETUP-CODE\n');
  return { dataDir, tokenPath };
}

const fakeRunner = () => ({ stdout: 'ok', stderr: '', status: 0 });

describe('integration: setup gate', () => {
  it('blocks API access while setup is required', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it('cannot complete setup without the token', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    rmSync(tokenPath, { force: true });
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    const res = await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'X', username: 'admin', password: 'password123' } });
    expect(res.statusCode).not.toBe(200);
    await app.close();
  });

  it('cannot complete setup twice', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'SETUP-CODE', username: 'admin', password: 'password123' } });
    const second = await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'SETUP-CODE', username: 'admin2', password: 'password123' } });
    expect(second.statusCode).not.toBe(200);
    await app.close();
  });
});

describe('integration: auth', () => {
  it('logs in, returns me, logs out', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'SETUP-CODE', username: 'admin', password: 'password123' } });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'password123' } });
    expect(login.statusCode).toBe(200);
    const cookie = login.headers['set-cookie'];
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe('admin');
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(logout.statusCode).toBe(200);
    const me2 = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me2.statusCode).toBe(401);
    await app.close();
  });
});

describe('integration: mutations, csrf, stale writes', () => {
  it('rejects mutation without csrf', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'SETUP-CODE', username: 'admin', password: 'password123' } });
    const cookie = setup.headers['set-cookie'];
    const res = await app.inject({ method: 'PATCH', url: '/api/settings', headers: { cookie }, payload: { region: { country: 'GB' } } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects stale If-Match', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'SETUP-CODE', username: 'admin', password: 'password123' } });
    const cookie = setup.headers['set-cookie'];
    const csrf = setup.json().csrfToken;
    const res = await app.inject({ method: 'PATCH', url: '/api/settings', headers: { cookie, 'x-csrf-token': csrf, 'if-match': '"deadbeef"' }, payload: { region: { country: 'GB' } } });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('mutation commits and rollback works', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    const setup = await app.inject({ method: 'POST', url: '/api/setup', payload: { setupCode: 'SETUP-CODE', username: 'admin', password: 'password123' } });
    const cookie = setup.headers['set-cookie'];
    const csrf = setup.json().csrfToken;
    const status = await app.inject({ method: 'GET', url: '/api/system/status', headers: { cookie } });
    const patch = await app.inject({ method: 'PATCH', url: '/api/settings', headers: { cookie, 'x-csrf-token': csrf, 'if-match': status.json().gitHead }, payload: { region: { country: 'GB' } } });
    expect(patch.statusCode).toBe(200);
    const snaps = await app.inject({ method: 'GET', url: '/api/snapshots', headers: { cookie } });
    expect(snaps.json().length).toBeGreaterThanOrEqual(2);
    const target = snaps.json()[1].sha;
    const rb = await app.inject({ method: 'POST', url: `/api/snapshots/${target}/rollback`, headers: { cookie, 'x-csrf-token': csrf } });
    expect(rb.statusCode).toBe(200);
    await app.close();
  });
});

describe('integration: internal bans', () => {
  it('rejects without token or non-loopback', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    const res = await app.inject({ method: 'POST', url: '/internal/bans', payload: { ip: '1.2.3.4' } });
    expect(res.statusCode).not.toBe(200);
    await app.close();
  });

  it('accepts with internal token on loopback', async () => {
    const { dataDir, tokenPath } = makeDataDir();
    const app = buildApp({ logger: false, dataDir, setupTokenPath: tokenPath, commandRunner: fakeRunner });
    // read internal token
    const { readFileSync } = await import('node:fs');
    const tok = readFileSync(join(dataDir, 'runtime', 'internal-token'), 'utf8').trim();
    const res = await app.inject({ method: 'POST', url: '/internal/bans', headers: { 'x-internal-token': tok }, remoteAddress: '127.0.0.1', payload: { ip: '1.2.3.4', banTime: 60 } });
    // inject remoteAddress may not set ip; use payload? app.ip from inject defaults to 127.0.0.1 likely
    console.log('ban res', res.statusCode, res.json());
    expect([200]).toContain(res.statusCode);
    await app.close();
  });
});

afterEach(() => {
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});