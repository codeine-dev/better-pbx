import { join } from 'node:path';

export interface ApiConfig {
  dataDir: string;
  configDir: string;
  modelPath: string;
  asteriskDir: string;
  runtimeDir: string;
  dbPath: string;
  setupTokenPath: string;
  internalTokenPath: string;
  webDistDir: string;
}

export function resolveConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  const dataDir = overrides.dataDir ?? process.env.PBX_DATA_DIR ?? '/data';
  const configDir = join(dataDir, 'config');
  return {
    dataDir,
    configDir,
    modelPath: join(configDir, 'pbx.yaml'),
    asteriskDir: join(configDir, 'asterisk'),
    runtimeDir: join(dataDir, 'runtime'),
    dbPath: join(dataDir, 'pbx.db'),
    setupTokenPath: overrides.setupTokenPath ?? process.env.PBX_SETUP_TOKEN_FILE ?? join(dataDir, 'setup-token'),
    internalTokenPath: join(dataDir, 'runtime', 'internal-token'),
    webDistDir: overrides.webDistDir ?? process.env.PBX_WEB_DIST ?? '/opt/better-pbx/web/dist',
    ...overrides,
  };
}