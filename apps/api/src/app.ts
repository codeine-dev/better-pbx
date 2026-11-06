import Fastify, { type FastifyInstance } from 'fastify';
import { existsSync } from 'node:fs';

/** Version reported by the health endpoint. Kept in one place so the image label and API agree. */
export const API_VERSION = '0.1.0';

export interface BuildAppOptions {
  /** Path to the one-time setup token. Defaults to the container path or `PBX_SETUP_TOKEN_FILE`. */
  setupTokenPath?: string;
  /** Disable Fastify's request logging in tests. */
  logger?: boolean;
}

/**
 * Minimal API for Phase 1. It proves the supervised Node process is reachable and exposes the
 * setup-gate state that the wizard will consume in Phase 4. The real API is assembled in Phase 3.
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const setupTokenPath =
    options.setupTokenPath ?? process.env.PBX_SETUP_TOKEN_FILE ?? '/data/setup-token';
  const app = Fastify({ logger: options.logger ?? true });
  const startedAt = Date.now();

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'better-pbx-api',
    version: process.env.PBX_VERSION ?? API_VERSION,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));

  app.get('/api/setup/status', async () => {
    const setupRequired = existsSync(setupTokenPath);
    return {
      setupRequired,
      initialized: !setupRequired,
    };
  });

  app.get('/', async () => ({
    name: 'BetterPBX',
    service: 'better-pbx-api',
    status: 'ok',
  }));

  return app;
}
