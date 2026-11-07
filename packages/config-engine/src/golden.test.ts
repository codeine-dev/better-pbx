import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildCompleteModel } from '@better-pbx/test-fixtures';

import { renderSecure } from './render-secure.js';

const GOLDEN_DIR = fileURLToPath(new URL('../../test-fixtures/golden/', import.meta.url));
const UPDATE = process.env.PBX_UPDATE_GOLDEN === '1';

function goldenRelative(key: string): string {
  return key.startsWith('/') ? key.replace(/^\/data\//, '') : key;
}

function listFiles(dir: string, root: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full, root));
    else result.push(relative(root, full).split(sep).join('/'));
  }
  return result.sort((a, b) => a.localeCompare(b, 'en'));
}

function renderFixture(): Record<string, string> {
  const model = buildCompleteModel();
  const result = renderSecure({
    model,
    runtime: { bannedCidrs: ['198.51.100.9/32'] },
  });
  return {
    ...result.files,
    ...Object.fromEntries(
      Object.entries(result.runtimeFiles).map(([key, content]) => [goldenRelative(key), content]),
    ),
  };
}

describe('golden configuration', () => {
  it('covers every feature in the model', () => {
    const model = buildCompleteModel();
    expect(model.extensions.length).toBeGreaterThanOrEqual(2);
    expect(model.trunks.length).toBeGreaterThanOrEqual(2);
    expect(model.outboundRoutes.length).toBeGreaterThanOrEqual(2);
    expect(model.inboundRoutes.length).toBeGreaterThanOrEqual(2);
    expect(model.ringGroups.length).toBeGreaterThanOrEqual(2);
    expect(model.ivrs.length).toBeGreaterThanOrEqual(2);
    expect(model.prompts.length).toBeGreaterThanOrEqual(2);
    expect(model.extensions.some((extension) => extension.voicemail.enabled)).toBe(true);
    expect(model.extensions.some((extension) => !extension.enabled)).toBe(true);
    expect(model.trunks.some((trunk) => !trunk.enabled)).toBe(true);
    expect(model.ivrs.some((ivr) => ivr.number === undefined)).toBe(true);
    expect(model.settings.network.tlsEnabled).toBe(true);
    expect(model.settings.security.whitelist.length).toBeGreaterThan(0);
    expect(model.settings.security.blacklist.length).toBeGreaterThan(0);
  });

  it('snapshots every rendered file', () => {
    const rendered = renderFixture();
    const expected = Object.keys(rendered).sort((a, b) => a.localeCompare(b, 'en'));

    if (UPDATE) {
      rmSync(GOLDEN_DIR, { recursive: true, force: true });
      mkdirSync(GOLDEN_DIR, { recursive: true });
      for (const [key, content] of Object.entries(rendered)) {
        const target = join(GOLDEN_DIR, key);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content, 'utf8');
      }
      return;
    }

    const goldenFiles = listFiles(GOLDEN_DIR, GOLDEN_DIR);
    expect(
      goldenFiles,
      'golden directory must contain exactly the rendered files; run PBX_UPDATE_GOLDEN=1 pnpm test to refresh',
    ).toEqual(expected);

    for (const key of expected) {
      const target = join(GOLDEN_DIR, key);
      expect(existsSync(target), `missing golden file ${key}`).toBe(true);
      expect(readFileSync(target, 'utf8'), `golden mismatch for ${key}`).toBe(rendered[key]);
    }
  });

  it('is stable across repeated renders', () => {
    expect(renderFixture()).toEqual(renderFixture());
  });
});
