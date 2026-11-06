import { z } from 'zod';

/**
 * Primitive model types shared by the API, the UI, and the config engine.
 *
 * These schemas are deliberately dependency-free beyond Zod so that the browser bundle and the
 * Node API can both use them. Anything that needs filesystem or process access belongs elsewhere.
 */

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_RE = new RegExp(`^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}$`);
const IPV4_CIDR_RE = new RegExp(`^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}/(?:3[0-2]|[12]?\\d)$`);

const IPV6_GROUP = '[0-9a-fA-F]{1,4}';
const IPV6_RE = new RegExp(
  '^(?:' +
    `(?:${IPV6_GROUP}:){7}${IPV6_GROUP}` +
    `|(?:${IPV6_GROUP}:){1,7}:` +
    `|(?:${IPV6_GROUP}:){1,6}:${IPV6_GROUP}` +
    `|(?:${IPV6_GROUP}:){1,5}(?::${IPV6_GROUP}){1,2}` +
    `|(?:${IPV6_GROUP}:){1,4}(?::${IPV6_GROUP}){1,3}` +
    `|(?:${IPV6_GROUP}:){1,3}(?::${IPV6_GROUP}){1,4}` +
    `|(?:${IPV6_GROUP}:){1,2}(?::${IPV6_GROUP}){1,5}` +
    `|${IPV6_GROUP}:(?:(?::${IPV6_GROUP}){1,6})` +
    '|::' +
    ')$',
);
const IPV6_CIDR_RE = new RegExp(
  '^(?:' +
    `(?:${IPV6_GROUP}:){7}${IPV6_GROUP}` +
    `|(?:${IPV6_GROUP}:){1,7}:` +
    `|(?:${IPV6_GROUP}:){1,6}:${IPV6_GROUP}` +
    `|(?:${IPV6_GROUP}:){1,5}(?::${IPV6_GROUP}){1,2}` +
    `|(?:${IPV6_GROUP}:){1,4}(?::${IPV6_GROUP}){1,3}` +
    `|(?:${IPV6_GROUP}:){1,3}(?::${IPV6_GROUP}){1,4}` +
    `|(?:${IPV6_GROUP}:){1,2}(?::${IPV6_GROUP}){1,5}` +
    `|${IPV6_GROUP}:(?:(?::${IPV6_GROUP}){1,6})` +
    '|::' +
    ')(?:/(?:12[0-8]|1[01]\\d|[1-9]?\\d))$',
);

export function isIpv4(value: string): boolean {
  return IPV4_RE.test(value);
}

export function isIpv6(value: string): boolean {
  return IPV6_RE.test(value);
}

export function isIp(value: string): boolean {
  return isIpv4(value) || isIpv6(value);
}

/** True for a bare address or a CIDR with a valid prefix (0-32 for IPv4, 0-128 for IPv6). */
export function isCidr(value: string): boolean {
  return IPV4_CIDR_RE.test(value) || IPV6_CIDR_RE.test(value) || isIp(value);
}

/** True when the CIDR covers every address and would therefore trust or block the whole internet. */
export function isCatchAllCidr(value: string): boolean {
  return (
    value === '0.0.0.0/0' ||
    value === '0.0.0.0' ||
    value === '::/0' ||
    value === '::' ||
    value === '::0/0'
  );
}

export const resourceIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, 'must be an alphanumeric identifier');

export const isoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    'must be an ISO-8601 UTC timestamp (YYYY-MM-DDTHH:mm:ssZ)',
  );

export const cidrSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isCidr, 'must be an IPv4/IPv6 address or CIDR');

export const cidrListSchema = z.array(cidrSchema).default([]);

export const codecSchema = z.enum(['ulaw', 'alaw', 'gsm', 'g722']);
export type Codec = z.infer<typeof codecSchema>;

/** Codecs are restricted to the safe, widely supported set; order expresses preference. */
export const codecListSchema = z
  .array(codecSchema)
  .min(1, 'at least one codec is required')
  .max(4)
  .default(['ulaw', 'alaw'])
  .refine((codecs) => new Set(codecs).size === codecs.length, 'codecs must be unique');

/** Extension, ring-group, and IVR numbers are short digit strings; no dialplan metacharacters. */
export const extensionNumberSchema = z
  .string()
  .regex(/^[0-9]{2,6}$/, 'must be 2-6 digits');

export const trunkNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'must be a lowercase slug');

export const displayNameSchema = z.string().trim().min(1).max(64);

export const sipSecretSchema = z
  .string()
  .min(8, 'SIP secrets must be at least 8 characters')
  .max(128)
  .regex(/^[^\s]+$/, 'SIP secrets must not contain whitespace');

export const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)*$/, 'must be an IANA timezone name');

export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'must be an ISO 3166-1 alpha-2 country code');

export const languageSchema = z
  .string()
  .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, 'must be a language tag such as en or en-US');
