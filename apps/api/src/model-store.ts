import { createDefaultModel, type PbxModel } from '@better-pbx/shared';
import { assertValidModel } from '@better-pbx/config-engine';
import { dump, load } from 'js-yaml';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ApiConfig } from './config.js';

export function ensureConfigLayout(config: ApiConfig): void {
  mkdirSync(config.configDir, { recursive: true });
  mkdirSync(config.runtimeDir, { recursive: true });
}

export function readModel(config: ApiConfig): PbxModel | null {
  if (!existsSync(config.modelPath)) return null;
  const raw = load(readFileSync(config.modelPath, 'utf8'));
  return raw as PbxModel;
}

export function readModelValidated(config: ApiConfig): PbxModel | null {
  const raw = readModel(config);
  if (raw === null) return null;
  return assertValidModel(raw);
}

export function writeModel(config: ApiConfig, model: PbxModel): void {
  mkdirSync(dirname(config.modelPath), { recursive: true });
  writeFileSync(config.modelPath, dump(model, { lineWidth: 120, noRefs: true }), 'utf8');
}

export function bootstrapModel(config: ApiConfig, pbxName?: string): PbxModel {
  const opts: { pbxName?: string; now: string } = { now: new Date().toISOString() };
  if (pbxName) opts.pbxName = pbxName;
  const model = createDefaultModel(opts);
  writeModel(config, model);
  return model;
}