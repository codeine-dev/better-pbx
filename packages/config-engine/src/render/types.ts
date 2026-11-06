import type { PbxModel } from '@better-pbx/shared';

/**
 * Paths embedded in rendered configuration. Production uses the appliance defaults; the
 * throwaway-Asterisk validator overrides them so it never touches real state.
 */
export interface RenderPaths {
  /** Directory Asterisk reads configuration from (`/etc/asterisk` in the image). */
  etcDir: string;
  /** Persistent state root (`/data` in the image); voicemail ends up in `${dataDir}/voicemail`. */
  dataDir: string;
  logDir: string;
  runDir: string;
}

export const DEFAULT_RENDER_PATHS: RenderPaths = {
  etcDir: '/etc/asterisk',
  dataDir: '/data',
  logDir: '/data/log',
  runDir: '/run/asterisk',
};

export interface RenderOptions {
  paths?: Partial<RenderPaths>;
}

/** Runtime-only inputs. Bans are not part of the committed model. */
export interface RuntimeState {
  /** IPs and CIDRs currently banned by fail2ban or manually by an admin. */
  bannedCidrs?: string[];
}

export interface RenderInput {
  model: PbxModel;
  runtime?: RuntimeState;
  options?: RenderOptions;
}

/** A rendered file keyed by its path relative to the configuration repository root. */
export interface RenderedTree {
  files: Record<string, string>;
  /** Files that live under /data/runtime and are never committed or snapshotted. */
  runtimeFiles: Record<string, string>;
}

export function resolvePaths(options: RenderOptions = {}): RenderPaths {
  return { ...DEFAULT_RENDER_PATHS, ...options.paths };
}
