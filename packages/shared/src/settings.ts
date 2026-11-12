import { z } from 'zod';

import {
  cidrListSchema,
  countryCodeSchema,
  languageSchema,
  timezoneSchema,
} from './primitives.js';

export const regionSettingsSchema = z.object({
  country: countryCodeSchema.default('US'),
  timezone: timezoneSchema.default('UTC'),
  language: languageSchema.default('en'),
  emergencyNumbers: z
    .array(z.string().regex(/^[0-9]{2,6}$/, 'emergency numbers are 2-6 digits'))
    .min(1, 'at least one emergency number is required')
    .default(['911'])
    .refine((numbers) => new Set(numbers).size === numbers.length, 'emergency numbers must be unique'),
  nationalPrefix: z
    .string()
    .regex(/^[0-9]{0,4}$/, 'must be 0-4 digits')
    .default('1'),
  internationalPrefix: z
    .string()
    .regex(/^[0-9]{0,4}$/, 'must be 0-4 digits')
    .default('011'),
  outsidePrefix: z
    .string()
    .regex(/^[0-9]{0,2}$/, 'must be 0-2 digits')
    .default('9'),
});

export type RegionSettings = z.infer<typeof regionSettingsSchema>;

export const networkSettingsSchema = z
  .object({
    externalAddress: z.string().trim().min(1).max(255).nullable().default(null),
    sipPort: z.number().int().min(1).max(65535).default(5060),
    tlsPort: z.number().int().min(1).max(65535).default(5061),
    rtpStart: z.number().int().min(1024).max(65535).default(10000),
    rtpEnd: z.number().int().min(1024).max(65535).default(20000),
    tlsEnabled: z.boolean().default(true),
    /** TLS protocol version for the SIP TLS transport. Empty means Asterisk/OpenSSL default. */
    tlsMethod: z.enum(['', 'tlsv1_2', 'tlsv1_3']).default('tlsv1_3'),
    /** Optional OpenSSL cipher list for the SIP TLS transport. Empty means default. */
    tlsCipher: z
      .string()
      .trim()
      .max(255)
      .regex(/^[A-Za-z0-9:+!@\- ]*$/, 'tlsCipher must be an OpenSSL cipher list')
      .default(''),
    /** Enable SRTP (SDES) media encryption on SIP endpoints when supported. */
    srtpEnabled: z.boolean().default(true),
    /** Enable DTLS-SRTP media encryption on SIP endpoints when supported. */
    dtlsSrtpEnabled: z.boolean().default(false),
  })
  .refine((network) => network.rtpStart <= network.rtpEnd, {
    message: 'rtpStart must be less than or equal to rtpEnd',
    path: ['rtpStart'],
  })
  .refine((network) => network.sipPort !== network.tlsPort, {
    message: 'sipPort and tlsPort must differ',
    path: ['tlsPort'],
  });

export type NetworkSettings = z.infer<typeof networkSettingsSchema>;

export const fail2banSettingsSchema = z.object({
  /** Fail2ban is always enabled; only its thresholds are configurable. */
  maxRetry: z.number().int().min(1).max(20).default(5),
  findTime: z.number().int().min(60).max(86_400).default(600),
  banTime: z.number().int().min(60).max(604_800).default(3600),
  increment: z.boolean().default(false),
});

export type Fail2banSettings = z.infer<typeof fail2banSettingsSchema>;

export const securitySettingsSchema = z.object({
  fail2ban: fail2banSettingsSchema.prefault({}),
  whitelist: cidrListSchema,
  blacklist: cidrListSchema,
});

export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const voicemailSettingsSchema = z.object({
  maxMessages: z.number().int().min(1).max(10_000).default(100),
  maxSeconds: z.number().int().min(10).max(3600).default(180),
  defaultPinLength: z.number().int().min(4).max(10).default(4),
});

export type VoicemailSettings = z.infer<typeof voicemailSettingsSchema>;

export const mcpSettingsSchema = z.object({
  /** Whether the MCP server endpoint is enabled. */
  enabled: z.boolean().default(true),
});

export type McpSettings = z.infer<typeof mcpSettingsSchema>;

export const settingsSchema = z.object({
  region: regionSettingsSchema.prefault({}),
  network: networkSettingsSchema.prefault({}),
  security: securitySettingsSchema.prefault({}),
  voicemail: voicemailSettingsSchema.prefault({}),
  mcp: mcpSettingsSchema.prefault({}),
});

export type Settings = z.infer<typeof settingsSchema>;
