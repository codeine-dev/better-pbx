import { describe, expect, it } from 'vitest';

import {
  createDefaultModel,
  createDefaultSettings,
  createExtension,
  createIvr,
  createPrompt,
  createTrunk,
  generateSipSecret,
  generateVoicemailPin,
  randomToken,
  type PbxModel,
} from '@better-pbx/shared';
import { buildCompleteModel } from '@better-pbx/test-fixtures';

import {
  DialplanPatternError,
  evaluateSecretStrength,
  isCatchAllPattern,
  parseDialplanPattern,
  patternMayReachPremium,
  premiumSamplesFor,
  renderPjsipAcl,
  validateModel,
} from './index.js';

describe('defaults', () => {
  it('creates fully populated, schema-valid defaults', () => {
    const model = createDefaultModel({ now: '2026-01-02T03:04:05Z' });
    const settings = createDefaultSettings();

    expect(settings).toEqual(model.settings);
    expect(settings.security.fail2ban.maxRetry).toBe(5);
    expect(settings.network.tlsEnabled).toBe(true);
    expect(settings.voicemail.defaultPinLength).toBe(4);
    expect(model.schemaVersion).toBe(1);
    expect(model.extensions).toEqual([]);
    expect(validateModel(model).issues).toEqual([]);
  });

  it('factory defaults keep every resource valid', () => {
    const extension = createExtension({ id: 'ext-1', number: '100' });
    const trunk = createTrunk({ id: 'trunk-1', name: 'primary', host: 'sip.example.net' });
    const prompt = createPrompt({ id: 'prompt-1', name: 'Greeting', kind: 'builtin', file: 'demo-congrats' });
    const ivr = createIvr({
      id: 'ivr-1',
      name: 'Menu',
      greetingPromptId: 'prompt-1',
      timeoutDestination: { type: 'hangup' },
    });

    expect(extension.codecs).toEqual(['ulaw', 'alaw']);
    expect(extension.transport).toBe('udp');
    expect(trunk.inboundMode).toBe('registration');
    expect(ivr.maxRetries).toBe(3);
    expect(prompt.kind).toBe('builtin');
  });
});

describe('validation failures', () => {
  it('reports field-level errors for an unsafe model', () => {
    const model = createDefaultModel();
    const unsafe: PbxModel = {
      ...model,
      extensions: [createExtension({ id: 'ext-1', number: '100', secret: '12345678' })],
      outboundRoutes: [
        {
          id: 'route-1',
          name: 'Catch all',
          priority: 10,
          trunkId: 'missing-trunk',
          patterns: [{ match: '_X.', strip: 0, prepend: '' }],
          allowPremium: false,
          enabled: true,
        },
      ],
    };

    const result = validateModel(unsafe);
    const codes = result.issues.map((entry) => entry.code);
    expect(codes).toContain('weak-secret');
    expect(codes).toContain('catch-all-route');
    expect(codes).toContain('unknown-trunk');
    for (const entry of result.issues) {
      expect(entry.path.length).toBeGreaterThan(0);
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });

  it('rejects a model that is not an object', () => {
    expect(validateModel('nope').issues[0]?.code).toBe('invalid-model');
    expect(validateModel(null).model).toBeNull();
  });
});

describe('dangerous patterns', () => {
  it('classifies catch-all and malformed patterns', () => {
    expect(isCatchAllPattern('_.')).toBe(true);
    expect(isCatchAllPattern('_X.')).toBe(true);
    expect(isCatchAllPattern('_!')).toBe(true);
    expect(isCatchAllPattern('_1NXXNXXXXXX')).toBe(false);
    expect(() => parseDialplanPattern('_X.Z')).toThrow(DialplanPatternError);
    expect(() => parseDialplanPattern('_1(2')).toThrow(DialplanPatternError);
  });

  it('detects patterns that can reach premium-rate numbers', () => {
    const samples = premiumSamplesFor(createDefaultModel());
    expect(patternMayReachPremium('_1NXXNXXXXXX', samples)).toBe(true);
    expect(patternMayReachPremium('_911', samples)).toBe(false);
  });
});

describe('ACL ordering', () => {
  it('places explicit denies before the default permit', () => {
    const model = buildCompleteModel();
    const acl = renderPjsipAcl(model, { bannedCidrs: ['198.51.100.9/32'] });
    const lines = acl
      .split('\n')
      .filter((line) => line.startsWith('permit =') || line.startsWith('deny ='));

    expect(lines[0]).toBe('permit = 203.0.113.0/24');
    expect(lines).toContain('deny = 192.0.2.7/32');
    expect(lines).toContain('deny = 198.51.100.9/32');
    expect(lines.at(-1)).toBe('permit = 0.0.0.0/0.0.0.0');
    expect(acl.indexOf('deny = 198.51.100.9/32')).toBeLessThan(
      acl.indexOf('permit = 0.0.0.0/0.0.0.0'),
    );
  });

  it('rejects a ban that would cover the whole internet', () => {
    expect(() => renderPjsipAcl(buildCompleteModel(), { bannedCidrs: ['0.0.0.0/0'] })).toThrow(
      /must not cover the whole internet/,
    );
  });
});

describe('secret generation', () => {
  it('generates strong, distinct SIP secrets and numeric PINs', () => {
    const first = generateSipSecret();
    const second = generateSipSecret();

    expect(first).toHaveLength(24);
    expect(second).toHaveLength(24);
    expect(first).not.toBe(second);
    expect(evaluateSecretStrength(first)).toBeUndefined();
    expect(evaluateSecretStrength(second)).toBeUndefined();
    expect(generateVoicemailPin(6)).toMatch(/^[0-9]{6}$/);
  });

  it('respects token alphabets and rejects invalid lengths', () => {
    expect(randomToken(16, 'hex')).toMatch(/^[0-9a-f]{16}$/);
    expect(randomToken(10, 'numeric')).toMatch(/^[0-9]{10}$/);
    expect(randomToken(10, 'uppercase')).toMatch(/^[A-Z]{10}$/);
    expect(() => randomToken(0)).toThrow(RangeError);
    expect(() => randomToken(257)).toThrow(RangeError);
  });

  it('rejects trivial secrets', () => {
    expect(evaluateSecretStrength('password')).toMatch(/commonly/);
    expect(evaluateSecretStrength('aaaaaaaaaaaa')).toMatch(/repeated/);
    expect(evaluateSecretStrength('short')).toMatch(/at least 12/);
    expect(evaluateSecretStrength('correct-horse-battery')).toBeUndefined();
  });
});
