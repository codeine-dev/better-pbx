import { z } from 'zod';

import { destinationSchema } from './destinations.js';
import {
  codecListSchema,
  displayNameSchema,
  extensionNumberSchema,
  isIp,
  resourceIdSchema,
  sipSecretSchema,
  trunkNameSchema,
} from './primitives.js';

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

export const hostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((value) => isIp(value) || HOSTNAME_RE.test(value), 'must be a hostname or IP address');

export const transportSchema = z.enum(['udp', 'tls']);
export type Transport = z.infer<typeof transportSchema>;

export const mailboxSchema = z
  .object({
    enabled: z.boolean().default(false),
    pin: z.string().regex(/^[0-9]{3,10}$/, 'voicemail PIN must be 3-10 digits').optional(),
    email: z.email('must be a valid email address').optional(),
  })
  .refine((mailbox) => !mailbox.enabled || mailbox.pin !== undefined, {
    message: 'a voicemail PIN is required when voicemail is enabled',
    path: ['pin'],
  });

export type Mailbox = z.infer<typeof mailboxSchema>;

export const extensionSchema = z.object({
  id: resourceIdSchema,
  number: extensionNumberSchema,
  displayName: displayNameSchema,
  secret: sipSecretSchema,
  codecs: codecListSchema,
  enabled: z.boolean().default(true),
  voicemail: mailboxSchema.prefault({}),
  callerId: z.string().trim().max(64).optional(),
  transport: transportSchema.default('udp'),
  maxContacts: z.number().int().min(1).max(10).default(2),
  /** Allows this extension to register from outside localNetworks; still authenticated. */
  remotePhone: z.boolean().default(false),
});

export type Extension = z.infer<typeof extensionSchema>;

export const trunkInboundModeSchema = z.enum(['registration', 'ip']);
export type TrunkInboundMode = z.infer<typeof trunkInboundModeSchema>;

export const trunkSchema = z
  .object({
    id: resourceIdSchema,
    name: trunkNameSchema,
    host: hostSchema,
    port: z.number().int().min(1).max(65535).default(5060),
    transport: transportSchema.default('udp'),
    username: z.string().trim().min(1).max(128).optional(),
    password: z.string().min(8).max(128).optional(),
    fromUser: z.string().trim().min(1).max(128).optional(),
    fromDomain: z.string().trim().min(1).max(253).optional(),
    callerId: z.string().trim().max(64).optional(),
    codecs: codecListSchema,
    inboundMode: trunkInboundModeSchema.default('registration'),
    providerCidrs: z.array(z.string().trim().min(1)).default([]),
    enabled: z.boolean().default(true),
  })
  .refine((trunk) => trunk.username === undefined || trunk.password !== undefined, {
    message: 'a password is required when a trunk username is set',
    path: ['password'],
  })
  .refine((trunk) => trunk.password === undefined || trunk.username !== undefined, {
    message: 'a username is required when a trunk password is set',
    path: ['username'],
  })
  .refine((trunk) => trunk.inboundMode !== 'ip' || trunk.providerCidrs.length > 0, {
    message: 'IP-authenticated trunks require at least one provider CIDR',
    path: ['providerCidrs'],
  });

export type Trunk = z.infer<typeof trunkSchema>;

export const outboundPatternSchema = z.object({
  /** Dialplan pattern such as `_1NXXNXXXXXX`. Validated by the config engine. */
  match: z.string().trim().min(1).max(64),
  strip: z.number().int().min(0).max(32).default(0),
  prepend: z
    .string()
    .regex(/^\+?[0-9]{0,20}$/, 'prepend must be digits with an optional leading +')
    .default(''),
});

export type OutboundPattern = z.infer<typeof outboundPatternSchema>;

export const outboundRouteSchema = z.object({
  id: resourceIdSchema,
  name: displayNameSchema,
  priority: z.number().int().min(1).max(9999).default(100),
  trunkId: resourceIdSchema,
  patterns: z.array(outboundPatternSchema).min(1, 'at least one pattern is required'),
  callerId: z.string().trim().max(64).optional(),
  /** Premium-rate prefixes stay blocked unless the operator opts in per route. */
  allowPremium: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type OutboundRoute = z.infer<typeof outboundRouteSchema>;

export const inboundRouteSchema = z.object({
  id: resourceIdSchema,
  name: displayNameSchema,
  did: z.string().trim().min(1).max(64),
  trunkId: resourceIdSchema.optional(),
  destination: destinationSchema,
  callerIdFilter: z.string().trim().max(128).optional(),
  enabled: z.boolean().default(true),
});

export type InboundRoute = z.infer<typeof inboundRouteSchema>;

export const ringGroupStrategySchema = z.enum(['ringall', 'linear', 'rrmemory']);
export type RingGroupStrategy = z.infer<typeof ringGroupStrategySchema>;

export const ringGroupSchema = z.object({
  id: resourceIdSchema,
  name: displayNameSchema,
  number: extensionNumberSchema,
  strategy: ringGroupStrategySchema.default('ringall'),
  memberIds: z.array(resourceIdSchema).min(1, 'a ring group needs at least one member'),
  ringTime: z.number().int().min(5).max(300).default(20),
  destinationIfNoAnswer: destinationSchema,
});

export type RingGroup = z.infer<typeof ringGroupSchema>;

export const ivrOptionSchema = z.object({
  digit: z.string().regex(/^[0-9*#]$/, 'menu digits are 0-9, * or #'),
  destination: destinationSchema,
});

export type IvrOption = z.infer<typeof ivrOptionSchema>;

export const ivrSchema = z
  .object({
    id: resourceIdSchema,
    name: displayNameSchema,
    number: extensionNumberSchema.optional(),
    greetingPromptId: resourceIdSchema,
    timeoutSeconds: z.number().int().min(1).max(30).default(5),
    maxRetries: z.number().int().min(0).max(10).default(3),
    options: z.array(ivrOptionSchema).default([]),
    timeoutDestination: destinationSchema,
    invalidDestination: destinationSchema.optional(),
    directDial: z.boolean().default(false),
  })
  .refine((ivr) => new Set(ivr.options.map((option) => option.digit)).size === ivr.options.length, {
    message: 'IVR menu digits must be unique',
    path: ['options'],
  });

export type Ivr = z.infer<typeof ivrSchema>;

export const promptKindSchema = z.enum(['builtin', 'custom']);
export type PromptKind = z.infer<typeof promptKindSchema>;

export const promptSchema = z
  .object({
    id: resourceIdSchema,
    name: displayNameSchema,
    kind: promptKindSchema,
    /** Built-in sound name, or a file below /data/sounds for custom prompts. */
    file: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/, 'must be a relative sound file name')
      .refine((file) => !file.split('/').includes('..'), 'must not contain path traversal'),
    originalName: z.string().trim().min(1).max(255).optional(),
    durationMs: z.number().int().min(0).max(3_600_000).optional(),
  })
  .refine((prompt) => prompt.kind !== 'custom' || prompt.file.startsWith('custom/'), {
    message: 'custom prompts must live under custom/',
    path: ['file'],
  });

export type Prompt = z.infer<typeof promptSchema>;
