import type { PbxModel } from '@better-pbx/shared';

import { renderConfig, type ConfigSection } from './config-format.js';

export function renderMusicOnHoldConf(model?: PbxModel): string {
  const sections: ConfigSection[] = [
    { name: 'general', lines: ['cachertclasses = yes'] },
    { name: 'default', lines: ['mode = files', 'directory = /var/lib/asterisk/moh'] },
  ];

  for (const entry of (model?.musicOnHold ?? []).slice().sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    sections.push({
      name: entry.id,
      lines: ['mode = files', `directory = /data/moh/${entry.id}`],
    });
  }

  return renderConfig(
    ['BetterPBX hold music. The official opsound pack is installed read-only in the image.'],
    sections,
  );
}
