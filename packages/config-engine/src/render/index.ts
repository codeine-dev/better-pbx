import type { PbxModel } from '@better-pbx/shared';

import { renderAsteriskConf } from './asterisk-conf.js';
import { renderCdrConf } from './cdr-conf.js';
import { renderFail2banTree } from './fail2ban.js';
import { renderExtensionsConf } from './extensions-conf.js';
import { renderFeaturesConf } from './features-conf.js';
import { renderIndicationsConf } from './indications-conf.js';
import { renderLoggerConf } from './logger-conf.js';
import { renderModulesConf } from './modules-conf.js';
import { renderMusicOnHoldConf } from './musiconhold-conf.js';
import { renderPjsipConf } from './pjsip-conf.js';
import { renderQueuesConf } from './queues-conf.js';
import { renderRtpConf } from './rtp-conf.js';
import { renderSafetyFiles } from './safety-files.js';
import { resolvePaths, type RenderOptions, type RenderedTree } from './types.js';
import { renderVoicemailConf } from './voicemail-conf.js';

export function sortRecord(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
}

/** All files below the configuration repository root. Paths are relative and stable. */
export function renderAsteriskTree(model: PbxModel, options: RenderOptions = {}): Record<string, string> {
  const paths = resolvePaths(options);
  return sortRecord({
    ...renderSafetyFiles(paths),
    'asterisk/asterisk.conf': renderAsteriskConf(paths),
    'asterisk/cdr.conf': renderCdrConf(),
    'asterisk/extensions.conf': renderExtensionsConf(model),
    'asterisk/features.conf': renderFeaturesConf(),
    'asterisk/indications.conf': renderIndicationsConf(model.settings.region),
    'asterisk/logger.conf': renderLoggerConf(),
    'asterisk/modules.conf': renderModulesConf(),
    'asterisk/musiconhold.conf': renderMusicOnHoldConf(),
    'asterisk/pjsip.conf': renderPjsipConf(model, paths),
    'asterisk/queues.conf': renderQueuesConf(model),
    'asterisk/rtp.conf': renderRtpConf(model.settings.network),
    'asterisk/voicemail.conf': renderVoicemailConf(model),
  });
}

/** Render every file in a config repository, including fail2ban. */
export function renderTree(model: PbxModel, options: RenderOptions = {}): RenderedTree {
  const paths = resolvePaths(options);
  return {
    files: sortRecord({
      ...renderAsteriskTree(model, options),
      ...renderFail2banTree(model, paths),
    }),
    runtimeFiles: {},
  };
}

export * from './types.js';
