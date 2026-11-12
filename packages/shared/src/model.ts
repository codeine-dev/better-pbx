import { z } from 'zod';

import { hasControlCharacters, isoDateTimeSchema } from './primitives.js';
import {
  extensionSchema,
  inboundRouteSchema,
  ivrSchema,
  musicOnHoldSchema,
  outboundRouteSchema,
  promptSchema,
  ringGroupSchema,
  trunkSchema,
} from './resources.js';
import { settingsSchema } from './settings.js';

/**
 * The on-disk configuration schema version. The API and the UI share this value so a model written
 * by one can always be validated by the other.
 */
export const CONFIG_SCHEMA_VERSION = 1;

export const schemaVersionSchema = z.literal(CONFIG_SCHEMA_VERSION);
export type SchemaVersion = z.infer<typeof schemaVersionSchema>;

export const metaSchema = z.object({
  pbxName: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((value) => !hasControlCharacters(value), 'must not contain control characters')
    .default('BetterPBX'),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Meta = z.infer<typeof metaSchema>;

/**
 * The complete PBX model. This is the source of truth: renderers may only read it and must never
 * mutate it, and no route or UI writes raw Asterisk configuration.
 */
const MOH_FIELD_ALIASES = ['musicOnHoldClasses', 'moh', 'mohClasses', 'musicOnHoldSongs', 'songs', 'musicOnHoldItems'];
const RING_GROUP_MOH_ALIASES = ['mohClassId', 'musicClass', 'moh', 'musicOnHold', 'holdMusic', 'musicOnHoldId'];

function normalizeMusicOnHold(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  const record = { ...(raw as Record<string, unknown>) };
  if (record.musicOnHold === undefined) {
    for (const alias of MOH_FIELD_ALIASES) {
      if (Array.isArray(record[alias])) {
        record.musicOnHold = record[alias];
        break;
      }
    }
  }
  if (Array.isArray(record.ringGroups)) {
    record.ringGroups = record.ringGroups.map((group) => {
      if (typeof group !== 'object' || group === null || Array.isArray(group)) return group;
      const g = { ...(group as Record<string, unknown>) };
      if (g.musicOnHoldClassId === undefined) {
        for (const alias of RING_GROUP_MOH_ALIASES) {
          if (g[alias] !== undefined) {
            g.musicOnHoldClassId = g[alias];
            break;
          }
        }
      }
      return g;
    });
  }
  return record;
}

export const pbxModelSchema = z.preprocess(
  normalizeMusicOnHold,
  z.object({
    schemaVersion: schemaVersionSchema,
    meta: metaSchema,
    settings: settingsSchema.prefault({}),
    extensions: z.array(extensionSchema).default([]),
    trunks: z.array(trunkSchema).default([]),
    outboundRoutes: z.array(outboundRouteSchema).default([]),
    inboundRoutes: z.array(inboundRouteSchema).default([]),
    ringGroups: z.array(ringGroupSchema).default([]),
    ivrs: z.array(ivrSchema).default([]),
    prompts: z.array(promptSchema).default([]),
    musicOnHold: z.array(musicOnHoldSchema).default([]),
  }),
);

export type PbxModel = z.infer<typeof pbxModelSchema>;
