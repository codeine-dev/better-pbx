import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const tempDirs: string[] = [];

function setupTokenPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'better-pbx-api-'));
  tempDirs.push(dir);
  return join(dir, 'setup-token');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('health endpoint', () => {
  it('reports the service as healthy', async () => {
    const app = buildApp({ logger: false, dataDir: mkdtempSync(join(tmpdir(), 'better-pbx-api-')) });
 
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'better-pbx-api',
      version: '0.1.0',
    });
    await app.close();
  });
});

describe('setup status endpoint', () => {
  it('requires setup while the one-time token exists', async () => {
    const tokenPath = setupTokenPath();
    writeFileSync(tokenPath, 'ABCD-EFGH\n');
    const app = buildApp({ logger: false, setupTokenPath: tokenPath, dataDir: join(tokenPath, '..') });

    const response = await app.inject({ method: 'GET', url: '/api/setup/status' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ setupRequired: true, initialized: false });
    await app.close();
  });

  it('reports setup as complete after the token is removed', async () => {
    const tokenPath = setupTokenPath();
    const app = buildApp({ logger: false, setupTokenPath: tokenPath, dataDir: join(tokenPath, '..') });

    const response = await app.inject({ method: 'GET', url: '/api/setup/status' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ setupRequired: false, initialized: true });
    await app.close();
  });
});
