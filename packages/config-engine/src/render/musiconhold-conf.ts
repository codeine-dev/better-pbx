import { renderConfig, type ConfigSection } from './config-format.js';

export function renderMusicOnHoldConf(): string {
  const sections: ConfigSection[] = [
    { name: 'general', lines: ['cachertclasses = yes'] },
    { name: 'default', lines: ['mode = files', 'directory = /var/lib/asterisk/moh'] },
  ];

  return renderConfig(
    ['BetterPBX hold music. The official opsound pack is installed read-only in the image.'],
    sections,
  );
}
