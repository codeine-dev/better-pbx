import { renderConfig, type ConfigSection } from './config-format.js';
import type { RenderPaths } from './types.js';

/** Directory layout. `astspooldir` is what places voicemail at `${dataDir}/voicemail`. */
export function renderAsteriskConf(paths: RenderPaths): string {
  const sections: ConfigSection[] = [
    {
      name: 'directories',
      lines: [
        `astetcdir => ${paths.etcDir}`,
        'astmoddir => /usr/lib/asterisk/modules',
        'astvarlibdir => /var/lib/asterisk',
        `astdbdir => ${paths.dataDir}`,
        'astkeydir => /var/lib/asterisk',
        'astdatadir => /var/lib/asterisk',
        'astagidir => /var/lib/asterisk/agi-bin',
        `astspooldir => ${paths.dataDir}`,
        `astrundir => ${paths.runDir}`,
        `astlogdir => ${paths.logDir}`,
        'astsbindir => /usr/sbin',
      ],
    },
    {
      name: 'options',
      lines: [
        '; Privilege dropping is handled by the s6 run script, so Asterisk must not setuid itself.',
        '; That avoids a harmless but noisy capability warning.',
        'astctlowner => asterisk',
        'astctlgroup => pbx',
        'astctlpermissions => 0660',
        'verbose = 5',
        'debug = 5',
      ],
    },
  ];

  return renderConfig(
    [
      'BetterPBX Asterisk directory layout.',
      '',
      'All mutable state lives under the data directory. Image-owned assets (sound packs, modules)',
      'stay read-only under /var/lib/asterisk.',
    ],
    sections,
  );
}
