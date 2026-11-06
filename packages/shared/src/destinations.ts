import { z } from 'zod';

import { resourceIdSchema } from './primitives.js';

/**
 * Where a call goes next. References use stable resource IDs, never numbers, so renaming an
 * extension or renumbering a ring group cannot silently point at the wrong destination.
 */
export const destinationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('extension'), extensionId: resourceIdSchema }),
  z.object({ type: z.literal('ringGroup'), ringGroupId: resourceIdSchema }),
  z.object({ type: z.literal('ivr'), ivrId: resourceIdSchema }),
  z.object({ type: z.literal('voicemail'), extensionId: resourceIdSchema }),
  z.object({ type: z.literal('hangup') }),
]);

export type Destination = z.infer<typeof destinationSchema>;

export const hangupDestination: Destination = { type: 'hangup' };

/** Human-readable form used in errors and audit messages. */
export function describeDestination(destination: Destination): string {
  switch (destination.type) {
    case 'extension':
      return `extension ${destination.extensionId}`;
    case 'ringGroup':
      return `ring group ${destination.ringGroupId}`;
    case 'ivr':
      return `IVR ${destination.ivrId}`;
    case 'voicemail':
      return `voicemail ${destination.extensionId}`;
    case 'hangup':
      return 'hangup';
  }
}
