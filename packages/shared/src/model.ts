import { z } from 'zod';

import { isoDateTimeSchema } from './primitives.js';
import {
  extensionSchema,
  inboundRouteSchema,
  ivrSchema,
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
  pbxName: z.string().trim().min(1).max(64).default('BetterPBX'),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type Meta = z.infer<typeof metaSchema>;

/**
 * The complete PBX model. This is the source of truth: renderers may only read it and must never
 * mutate it, and no route or UI writes raw Asterisk configuration.
 */
export const pbxModelSchema = z.object({
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
});

export type PbxModel = z.infer<typeof pbxModelSchema>;
