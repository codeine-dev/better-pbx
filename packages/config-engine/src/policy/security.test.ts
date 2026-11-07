import { describe, expect, it } from 'vitest';

import { createDefaultModel, createExtension, createTrunk, type PbxModel } from '@better-pbx/shared';
import { buildCompleteModel } from '@better-pbx/test-fixtures';

import { renderSecure } from '../render-secure.js';
import {
  SecurityPolicyError,
  assertSecurityPolicy,
  checkSecurityPolicy,
  evaluateSecretStrength,
  isCatchAllRoutePattern,
} from './security.js';
import { renderPjsipAcl } from './acl.js';
import { cidrOverlaps } from './cidr.js';
import { scanRenderedConfig } from './rendered.js';

function withRoutePattern(match: string, allowPremium = false): PbxModel {
  const model = buildCompleteModel();
  const [first, ...rest] = model.outboundRoutes;
  return {
    ...model,
    outboundRoutes: [
      { ...first!, allowPremium, patterns: [{ match, strip: 0, prepend: '' }] },
      ...rest,
    ],
  };
}

describe('security policy', () => {
  it('accepts the complete, safe fixture', () => {
    const model = buildCompleteModel();
    expect(checkSecurityPolicy(model)).toEqual([]);
    expect(() => assertSecurityPolicy(model)).not.toThrow();
    expect(Object.keys(renderSecure({ model }).files).length).toBeGreaterThan(20);
  });

  it('classifies catch-all dialplan patterns', () => {
    for (const pattern of ['_.', '_X.', '_X!', '_[0-9].', '_!']) {
      expect(isCatchAllRoutePattern(pattern)).toBe(true);
    }
    expect(isCatchAllRoutePattern('_1NXXNXXXXXX')).toBe(false);
    expect(isCatchAllRoutePattern('911')).toBe(false);
  });

  it('rejects catch-all outbound routes unless explicitly confirmed', () => {
    for (const match of ['_.', '_X.', '_!', '_X!']) {
      const issues = checkSecurityPolicy(withRoutePattern(match));
      expect(issues.some((entry) => entry.code === 'catch-all-route')).toBe(true);
    }
    const confirmed = checkSecurityPolicy(withRoutePattern('_X.'), { allowCatchAllRoutes: true });
    expect(confirmed.some((entry) => entry.code === 'catch-all-route')).toBe(false);
    expect(() => renderSecure({ model: withRoutePattern('_X.') })).toThrow(
      /catch-all outbound routes/,
    );
    const singleRoute = withRoutePattern('_X.', true);
    const isolated = { ...singleRoute, outboundRoutes: singleRoute.outboundRoutes.slice(0, 1) };
    expect(() =>
      renderSecure({ model: isolated, policy: { allowCatchAllRoutes: true } }),
    ).not.toThrow();
  });

  it('blocks premium-rate routes unless allowPremium is set', () => {
    const issues = checkSecurityPolicy(withRoutePattern('_1NXXNXXXXXX'));
    expect(issues.some((entry) => entry.code === 'premium-route')).toBe(true);

    const model = withRoutePattern('_1NXXNXXXXXX');
    const [first, ...rest] = model.outboundRoutes;
    const optedIn = {
      ...model,
      outboundRoutes: [{ ...first!, allowPremium: true }, ...rest],
    };
    expect(checkSecurityPolicy(optedIn).some((entry) => entry.code === 'premium-route')).toBe(false);
  });

  it('rejects weak secrets and equal-to-number secrets', () => {
    expect(evaluateSecretStrength('short')).toMatch(/at least 12/);
    expect(evaluateSecretStrength('password')).toMatch(/commonly used/);
    expect(evaluateSecretStrength('aaaaaaaaaaaa')).toMatch(/repeated/);
    expect(evaluateSecretStrength('correct-horse-battery')).toBeUndefined();

    const model = createDefaultModel();
    const unsafe = {
      ...model,
      extensions: [
        createExtension({ id: 'ext-1', number: '100', secret: '12345678' }),
        createExtension({
          id: 'ext-2',
          number: '101',
          displayName: 'bob-super-secret',
          secret: 'bob-super-secret',
        }),
        createExtension({ id: 'ext-3', number: '102', secret: 'password' }),
      ],
    };
    const issues = checkSecurityPolicy(unsafe);
    expect(issues.filter((entry) => entry.code === 'weak-secret')).toHaveLength(3);
  });

  it('rejects catch-all, invalid, and mutually exclusive CIDRs', () => {
    const model = createDefaultModel();
    const unsafe: PbxModel = {
      ...model,
      settings: {
        ...model.settings,
        security: {
          ...model.settings.security,
          whitelist: ['0.0.0.0/0', '203.0.113.0/24', 'not-a-cidr'],
          blacklist: ['203.0.113.7/32'],
        },
      },
    };
    const issues = checkSecurityPolicy(unsafe);
    expect(issues.some((entry) => entry.code === 'catch-all-cidr')).toBe(true);
    expect(issues.some((entry) => entry.code === 'invalid-cidr')).toBe(true);
    expect(issues.some((entry) => entry.code === 'acl-conflict')).toBe(true);
    expect(cidrOverlaps('10.0.0.0/8', '10.1.2.3/32')).toBe(true);
    expect(cidrOverlaps('10.0.0.0/8', '192.168.0.0/16')).toBe(false);
  });

  it('rejects unauthenticated trunks and open provider ranges', () => {
    const model = createDefaultModel();
    const unsafe: PbxModel = {
      ...model,
      trunks: [
        createTrunk({ id: 'trunk-a', name: 'a', host: 'sip.example.net' }),
        createTrunk({
          id: 'trunk-b',
          name: 'b',
          host: '198.51.100.20',
          inboundMode: 'ip',
          providerCidrs: ['0.0.0.0/0'],
        }),
      ],
    };
    const issues = checkSecurityPolicy(unsafe);
    expect(issues.some((entry) => entry.code === 'unauthenticated-trunk')).toBe(true);
    expect(issues.some((entry) => entry.code === 'catch-all-cidr')).toBe(true);
  });

  it('renders the runtime ACL with whitelist permits before bans and a default permit', () => {
    const model = buildCompleteModel();
    const acl = renderPjsipAcl(model, { bannedCidrs: ['198.51.100.9/32'] });

    expect(acl).toContain('[global-acl]');
    expect(acl).toContain('permit = 203.0.113.0/24');
    expect(acl).toContain('deny = 192.0.2.7/32');
    expect(acl).toContain('deny = 198.51.100.9/32');
    expect(acl).toContain('permit = 0.0.0.0/0.0.0.0');
    expect(acl.indexOf('deny = 198.51.100.9/32')).toBeLessThan(
      acl.indexOf('permit = 0.0.0.0/0.0.0.0'),
    );
    expect(() => renderPjsipAcl(model, { bannedCidrs: ['0.0.0.0/0'] })).toThrow(
      SecurityPolicyError,
    );
  });

  it('scans rendered config for disabled fail2ban and dangerous modules', () => {
    const rendered = renderSecure({ model: buildCompleteModel() });
    const files = { ...rendered.files, 'fail2ban/jail.d/better-pbx.local': '[better-pbx]\nenabled = false\n' };
    expect(scanRenderedConfig(files).some((entry) => entry.code === 'fail2ban-disabled')).toBe(true);

    const withDangerousModule = {
      ...rendered.files,
      'asterisk/modules.conf': '[modules]\nautoload = no\nload = app_system.so\n',
    };
    expect(
      scanRenderedConfig(withDangerousModule).some((entry) => entry.code === 'forbidden-module'),
    ).toBe(true);
  });
});
