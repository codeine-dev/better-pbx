import type { PbxModel } from '@better-pbx/shared';

import { same, sanitizeValue } from '../render/config-format.js';
import { trunkEndpoint } from '../model-lookup.js';
import { primaryOutboundTrunk } from './conflicts.js';

/**
 * Emergency numbers are generated as explicit, highest-priority internal extensions. They dial the
 * primary enabled trunk directly and never depend on an outbound route pattern, so an operator
 * cannot accidentally remove emergency dialling while editing routes.
 */
export function emergencyDialplanEntries(model: PbxModel): string[] {
  const trunk = primaryOutboundTrunk(model);
  return model.settings.region.emergencyNumbers.flatMap((number) => {
    if (trunk === undefined) {
      return [
        `exten => ${number},1,NoOp(${sanitizeValue(`Emergency call ${number}: no outbound trunk configured`)})`,
        same('Playback(ss-noservice)'),
        same('Hangup()'),
      ];
    }
    return [
      `exten => ${number},1,NoOp(${sanitizeValue(`Emergency call ${number} via ${trunk.name}`)})`,
      same(`Dial(PJSIP/\${EXTEN}@${trunkEndpoint(trunk.id)},120)`),
      same('Hangup()'),
    ];
  });
}
