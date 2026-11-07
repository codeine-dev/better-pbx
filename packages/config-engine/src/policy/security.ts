import {
  isCatchAllCidr,
  isCidr,
  type PbxModel,
} from '@better-pbx/shared';

import {
  isCatchAllPattern,
  parseDialplanPattern,
  patternMatches,
  DialplanPatternError,
} from '../dialplan/pattern.js';
import { cidrOverlaps, normalizeCidr } from './cidr.js';

export type PolicySeverity = 'error' | 'warning';

export interface PolicyIssue {
  code: string;
  /** Field-level path, e.g. `extensions[0].secret`, suitable for API error responses. */
  path: string;
  message: string;
  severity: PolicySeverity;
}

export interface SecurityPolicyOptions {
  /**
   * One-time explicit confirmation allowing a catch-all outbound route. The default is false:
   * the API may only set this after a separate, audited confirmation step.
   */
  allowCatchAllRoutes?: boolean;
}

const ERROR = 'error' as const;

function issue(code: string, path: string, message: string): PolicyIssue {
  return { code, path, message, severity: ERROR };
}

/**
 * Premium-rate and high-risk number ranges. These are deliberately conservative and country
 * agnostic: an operator can opt in per outbound route, but never by accident.
 */
export const PREMIUM_PREFIXES = [
  '1900',
  '1901',
  '1902',
  '1903',
  '1904',
  '1905',
  '1906',
  '1907',
  '1908',
  '1909',
  '1976',
  '090',
  '091',
  '092',
  '093',
  '094',
  '095',
  '096',
  '097',
  '098',
  '099',
  '0844',
  '0845',
  '0870',
  '0871',
  '0872',
  '0873',
  '118',
  '119',
] as const;

export function premiumSamplesFor(model: PbxModel): string[] {
  const region = model.settings.region;
  const leadIns = ['', region.outsidePrefix, region.nationalPrefix, region.internationalPrefix];
  const samples = new Set<string>();
  for (const prefix of PREMIUM_PREFIXES) {
    for (const leadIn of leadIns) {
      const base = `${leadIn}${prefix}`;
      samples.add(base);
      samples.add(`${base}0`);
      samples.add(`${base}5550100`);
      samples.add(base.padEnd(11, '5'));
    }
  }
  return [...samples];
}

export function patternMayReachPremium(raw: string, samples: string[]): boolean {
  return samples.some((sample) => patternMatches(raw, sample));
}

const WEAK_SECRETS = new Set([
  'password',
  'passw0rd',
  'changeme',
  'secret',
  'admin',
  'asterisk',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyuiop',
  'letmein',
]);

export function evaluateSecretStrength(secret: string): string | undefined {
  if (WEAK_SECRETS.has(secret.toLowerCase())) return 'is a commonly used password';
  if (secret.length < 12) return 'must be at least 12 characters';
  if (/^(.)\1+$/.test(secret)) return 'must not be a repeated character';
  const lower = secret.toLowerCase();
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', '9876543210', 'qwertyuiop'];
  if (sequences.some((sequence) => sequence.includes(lower))) {
    return 'must not be a simple sequence';
  }
  return undefined;
}

function validateCidrList(
  values: string[],
  path: string,
  label: string,
  issues: PolicyIssue[],
): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = normalizeCidr(values[index] ?? '');
    if (!isCidr(value)) {
      issues.push(issue('invalid-cidr', `${path}[${index}]`, `${label} entry is not a valid IP or CIDR`));
      continue;
    }
    if (isCatchAllCidr(value)) {
      issues.push(
        issue('catch-all-cidr', `${path}[${index}]`, `${label} must not cover the whole internet`),
      );
    }
    for (let earlier = 0; earlier < index; earlier += 1) {
      if (cidrOverlaps(value, normalizeCidr(values[earlier] ?? ''))) {
        issues.push(
          issue('duplicate-cidr', `${path}[${index}]`, `${label} entries overlap with ${path}[${earlier}]`),
        );
      }
    }
  }
}

function checkNetworkAndAcls(model: PbxModel, issues: PolicyIssue[]): void {
  const security = model.settings.security;
  validateCidrList(security.whitelist, 'settings.security.whitelist', 'whitelist', issues);
  validateCidrList(security.blacklist, 'settings.security.blacklist', 'blacklist', issues);
  validateCidrList(model.settings.network.localNetworks, 'settings.network.localNetworks', 'local network', issues);

  for (let whiteIndex = 0; whiteIndex < security.whitelist.length; whiteIndex += 1) {
    for (let blackIndex = 0; blackIndex < security.blacklist.length; blackIndex += 1) {
      const white = normalizeCidr(security.whitelist[whiteIndex] ?? '');
      const black = normalizeCidr(security.blacklist[blackIndex] ?? '');
      if (cidrOverlaps(white, black)) {
        issues.push(
          issue(
            'acl-conflict',
            `settings.security.blacklist[${blackIndex}]`,
            `blacklist entry overlaps whitelist entry settings.security.whitelist[${whiteIndex}]; an address cannot be both`,
          ),
        );
      }
    }
  }
}

function checkEndpoints(model: PbxModel, issues: PolicyIssue[]): void {
  model.extensions.forEach((extension, index) => {
    const weakness = evaluateSecretStrength(extension.secret);
    if (weakness !== undefined) {
      issues.push(
        issue('weak-secret', `extensions[${index}].secret`, `SIP secret ${weakness}`),
      );
    }
    if (extension.secret === extension.number || extension.secret === extension.displayName) {
      issues.push(
        issue('weak-secret', `extensions[${index}].secret`, 'SIP secret must not equal the extension number or name'),
      );
    }
    if (extension.transport === 'tls' && !model.settings.network.tlsEnabled) {
      issues.push(
        issue('tls-disabled', `extensions[${index}].transport`, 'TLS transport is disabled in network settings'),
      );
    }
    if (extension.voicemail.enabled && extension.voicemail.pin === undefined) {
      issues.push(
        issue('missing-pin', `extensions[${index}].voicemail.pin`, 'voicemail requires a PIN'),
      );
    }
  });
}

function checkTrunks(model: PbxModel, issues: PolicyIssue[]): void {
  model.trunks.forEach((trunk, index) => {
    if (trunk.host === '0.0.0.0' || trunk.host === '::') {
      issues.push(
        issue('invalid-trunk-host', `trunks[${index}].host`, 'a trunk must target a specific provider host'),
      );
    }
    if (trunk.inboundMode === 'registration') {
      if (trunk.username === undefined || trunk.password === undefined) {
        issues.push(
          issue(
            'unauthenticated-trunk',
            `trunks[${index}].username`,
            'registration-based trunks require both a username and password',
          ),
        );
      }
    } else {
      if (trunk.providerCidrs.length === 0) {
        issues.push(
          issue(
            'unauthenticated-trunk',
            `trunks[${index}].providerCidrs`,
            'IP-authenticated trunks require at least one provider CIDR',
          ),
        );
      }
      validateCidrList(trunk.providerCidrs, `trunks[${index}].providerCidrs`, 'provider CIDR', issues);
    }
    if (trunk.password !== undefined) {
      const weakness = evaluateSecretStrength(trunk.password);
      if (weakness !== undefined) {
        issues.push(
          issue('weak-secret', `trunks[${index}].password`, `trunk password ${weakness}`),
        );
      }
    }
    if (trunk.transport === 'tls' && !model.settings.network.tlsEnabled) {
      issues.push(
        issue('tls-disabled', `trunks[${index}].transport`, 'TLS transport is disabled in network settings'),
      );
    }
  });
}

function checkOutboundRoutes(
  model: PbxModel,
  options: SecurityPolicyOptions,
  issues: PolicyIssue[],
): void {
  const premiumSamples = premiumSamplesFor(model);
  const trunkIds = new Set(model.trunks.map((trunk) => trunk.id));

  model.outboundRoutes.forEach((route, routeIndex) => {
    if (!route.enabled) return;
    if (!trunkIds.has(route.trunkId)) {
      issues.push(
        issue('unknown-trunk', `outboundRoutes[${routeIndex}].trunkId`, 'outbound route references an unknown trunk'),
      );
    }
    const trunk = model.trunks.find((candidate) => candidate.id === route.trunkId);
    if (trunk !== undefined && !trunk.enabled) {
      issues.push(
        issue('disabled-trunk', `outboundRoutes[${routeIndex}].trunkId`, 'outbound route references a disabled trunk'),
      );
    }

    route.patterns.forEach((pattern, patternIndex) => {
      const path = `outboundRoutes[${routeIndex}].patterns[${patternIndex}].match`;
      let parsed: ReturnType<typeof parseDialplanPattern>;
      try {
        parsed = parseDialplanPattern(pattern.match);
      } catch (error) {
        issues.push(
          issue(
            'invalid-pattern',
            path,
            error instanceof DialplanPatternError ? error.message : 'invalid dialplan pattern',
          ),
        );
        return;
      }

      if (parsed.catchAll && !options.allowCatchAllRoutes) {
        issues.push(
          issue(
            'catch-all-route',
            path,
            'catch-all outbound routes are rejected by default; add a specific pattern instead',
          ),
        );
      }

      if (!route.allowPremium && patternMayReachPremium(pattern.match, premiumSamples)) {
        issues.push(
          issue(
            'premium-route',
            `outboundRoutes[${routeIndex}].allowPremium`,
            'this pattern can reach premium-rate numbers; set allowPremium on the route to opt in',
          ),
        );
      }

      if (parsed.maxLength !== null && pattern.strip >= parsed.maxLength) {
        issues.push(
          issue(
            'invalid-strip',
            `outboundRoutes[${routeIndex}].patterns[${patternIndex}].strip`,
            'strip removes the entire dialled number',
          ),
        );
      }
      if (parsed.maxLength === null && pattern.strip > parsed.minLength && parsed.minLength <= 1) {
        issues.push(
          issue(
            'invalid-strip',
            `outboundRoutes[${routeIndex}].patterns[${patternIndex}].strip`,
            'strip is larger than the pattern prefix',
          ),
        );
      }
    });
  });
}

function checkInboundRoutes(model: PbxModel, issues: PolicyIssue[]): void {
  model.inboundRoutes.forEach((route, index) => {
    if (!route.enabled) return;
    try {
      parseDialplanPattern(route.did);
    } catch (error) {
      issues.push(
        issue(
          'invalid-did',
          `inboundRoutes[${index}].did`,
          error instanceof DialplanPatternError ? error.message : 'invalid DID pattern',
        ),
      );
    }
    if (/["\r\n\\]/.test(route.callerIdFilter ?? '')) {
      issues.push(
        issue(
          'invalid-callerid-filter',
          `inboundRoutes[${index}].callerIdFilter`,
          'callerIdFilter must be a safe regular expression without quotes, backslashes, or newlines',
        ),
      );
    }
  });
}

/**
 * Check every security invariant before a model is applied. Errors are field-level and actionable;
 * no caller is allowed to weaken them to make a validation pass.
 */
export function checkSecurityPolicy(
  model: PbxModel,
  options: SecurityPolicyOptions = {},
): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  checkNetworkAndAcls(model, issues);
  checkEndpoints(model, issues);
  checkTrunks(model, issues);
  checkOutboundRoutes(model, options, issues);
  checkInboundRoutes(model, issues);

  // Fail2ban is always enabled; make sure thresholds stay in the hardened range even if a caller
  // bypassed the schema. The jail itself is rendered with enabled = true.
  const fail2ban = model.settings.security.fail2ban;
  if (fail2ban.maxRetry < 1 || fail2ban.findTime < 60 || fail2ban.banTime < 60) {
    issues.push(
      issue('weak-fail2ban', 'settings.security.fail2ban', 'fail2ban thresholds are too permissive'),
    );
  }

  return issues;
}

export class SecurityPolicyError extends Error {
  override readonly name = 'SecurityPolicyError';

  constructor(readonly issues: PolicyIssue[]) {
    super(
      `security policy rejected the model:\n${issues
        .map((entry) => `  - ${entry.path}: ${entry.message}`)
        .join('\n')}`,
    );
  }
}

export function assertSecurityPolicy(
  model: PbxModel,
  options: SecurityPolicyOptions = {},
): void {
  const issues = checkSecurityPolicy(model, options);
  if (issues.length > 0) throw new SecurityPolicyError(issues);
}

/** Convenience predicate for tests and audits. */
export function isCatchAllRoutePattern(raw: string): boolean {
  return isCatchAllPattern(raw);
}
