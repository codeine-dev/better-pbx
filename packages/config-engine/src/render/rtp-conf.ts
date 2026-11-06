import type { NetworkSettings } from '@better-pbx/shared';

import { renderConfig, type ConfigSection } from './config-format.js';

export function renderRtpConf(network: NetworkSettings): string {
  const sections: ConfigSection[] = [
    {
      name: 'general',
      lines: [
        `rtpstart = ${network.rtpStart}`,
        `rtpend = ${network.rtpEnd}`,
        'rtpchecksums = no',
        'strictrtp = yes',
        'icesupport = no',
      ],
    },
  ];

  return renderConfig(
    ['BetterPBX RTP configuration. The port range is explicit and documented.'],
    sections,
  );
}
