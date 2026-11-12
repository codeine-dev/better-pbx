import { describe, expect, it } from 'vitest';

import {
  CONFIG_SCHEMA_VERSION,
  ModelMigrationError,
  createDefaultModel,
  createDefaultSettings,
  createExtension,
  createIvr,
  createOutboundRoute,
  createPrompt,
  createRingGroup,
  createTrunk,
  destinationSchema,
  generateSipSecret,
  generateVoicemailPin,
  isCatchAllCidr,
  isCidr,
  migrateModel,
  pbxModelSchema,
  randomToken,
} from './index.js';

describe('model schema', () => {
  it('pins the configuration schema to version 1', () => {
    expect(CONFIG_SCHEMA_VERSION).toBe(1);
    expect(pbxModelSchema.parse(createDefaultModel()).schemaVersion).toBe(1);
  });

  it('creates safe defaults for a brand-new appliance', () => {
    const model = createDefaultModel({ now: '2026-01-02T03:04:05Z' });

    expect(model.meta).toEqual({
      pbxName: 'BetterPBX',
      createdAt: '2026-01-02T03:04:05Z',
      updatedAt: '2026-01-02T03:04:05Z',
    });
    expect(model.settings.region).toMatchObject({ country: 'US', timezone: 'UTC', language: 'en' });
    expect(model.settings.security.fail2ban).toMatchObject({ maxRetry: 5, banTime: 3600 });
    expect(model.settings.security.whitelist).toEqual([]);
    expect(model.settings.security.blacklist).toEqual([]);
    expect(model.settings.network).toMatchObject({ sipPort: 5060, tlsPort: 5061, tlsEnabled: true });
    expect(model.settings.voicemail).toMatchObject({ maxMessages: 100, maxSeconds: 180 });
    expect(model.extensions).toEqual([]);
    expect(model.trunks).toEqual([]);
    expect(model.outboundRoutes).toEqual([]);
    expect(model.inboundRoutes).toEqual([]);
    expect(model.ringGroups).toEqual([]);
    expect(model.ivrs).toEqual([]);
    expect(model.prompts).toEqual([]);
  });

  it('fills defaults in partial settings', () => {
    const settings = createDefaultSettings();
    expect(settings.region.emergencyNumbers).toEqual(['911']);
    expect(settings.network.rtpStart).toBe(10000);
    expect(settings.network.rtpEnd).toBe(20000);
  });

  it('rejects invalid network ranges', () => {
    const model = createDefaultModel();
    expect(() =>
      pbxModelSchema.parse({
        ...model,
        settings: { ...model.settings, network: { ...model.settings.network, rtpStart: 30000 } },
      }),
    ).toThrow(/rtpStart/);
  });
});

describe('destination union', () => {
  it('accepts every reference kind', () => {
    for (const destination of [
      { type: 'extension', extensionId: 'ext-1' },
      { type: 'ringGroup', ringGroupId: 'rg-1' },
      { type: 'ivr', ivrId: 'ivr-1' },
      { type: 'voicemail', extensionId: 'ext-1' },
      { type: 'hangup' },
    ]) {
      expect(destinationSchema.parse(destination)).toEqual(destination);
    }
  });

  it('rejects unknown destinations and missing references', () => {
    expect(() => destinationSchema.parse({ type: 'queue', queueId: 'q' })).toThrow();
    expect(() => destinationSchema.parse({ type: 'extension' })).toThrow();
  });
});

describe('primitives', () => {
  it('validates CIDRs and spots catch-all ranges', () => {
    expect(isCidr('192.0.2.0/24')).toBe(true);
    expect(isCidr('10.1.2.3')).toBe(true);
    expect(isCidr('2001:db8::/32')).toBe(true);
    expect(isCidr('300.1.2.3')).toBe(false);
    expect(isCidr('192.0.2.0/33')).toBe(false);
    expect(isCatchAllCidr('0.0.0.0/0')).toBe(true);
    expect(isCatchAllCidr('::/0')).toBe(true);
    expect(isCatchAllCidr('10.0.0.0/8')).toBe(false);
  });

  it('generates strong secrets of the requested shape', () => {
    const secret = generateSipSecret();
    expect(secret).toHaveLength(24);
    expect(secret).not.toMatch(/\s/);
    expect(generateVoicemailPin(6)).toMatch(/^[0-9]{6}$/);
    expect(randomToken(12, 'uppercase')).toMatch(/^[A-Z]{12}$/);
    expect(() => randomToken(0)).toThrow(RangeError);
  });
});

describe('resource factories', () => {
  it('creates extensions with safe defaults and a generated secret', () => {
    const extension = createExtension({ id: 'ext-100', number: '100', displayName: 'Alice' });

    expect(extension).toMatchObject({
      id: 'ext-100',
      number: '100',
      codecs: ['ulaw', 'alaw'],
      enabled: true,
      transport: 'udp',
      maxContacts: 2,
      voicemail: { enabled: false },
    });
    expect(extension.secret.length).toBeGreaterThanOrEqual(8);
  });

  it('requires a PIN when voicemail is enabled', () => {
    expect(() =>
      createExtension({
        id: 'ext-101',
        number: '101',
        voicemail: { enabled: true },
      }),
    ).toThrow(/PIN/);
  });

  it('requires provider CIDRs for IP-authenticated trunks', () => {
    expect(() => createTrunk({ id: 'trunk-a', name: 'a', host: 'sip.example.net', inboundMode: 'ip' })).toThrow(
      /provider CIDR/,
    );
    expect(
      createTrunk({
        id: 'trunk-a',
        name: 'a',
        host: 'sip.example.net',
        inboundMode: 'ip',
        providerCidrs: ['192.0.2.0/24'],
      }).providerCidrs,
    ).toEqual(['192.0.2.0/24']);
  });

  it('creates routes, ring groups, IVRs and prompts', () => {
    const route = createOutboundRoute({
      id: 'route-1',
      name: 'National',
      trunkId: 'trunk-a',
      patterns: [{ match: '_1NXXNXXXXXX', strip: 1, prepend: '1' }],
    });
    expect(route).toMatchObject({ priority: 100, allowPremium: false, enabled: true });

    const ringGroup = createRingGroup({
      id: 'rg-1',
      name: 'Sales',
      number: '600',
      memberIds: ['ext-100'],
      destinationIfNoAnswer: { type: 'hangup' },
    });
    expect(ringGroup).toMatchObject({ strategy: 'ringall', ringTime: 20 });

    const ivr = createIvr({
      id: 'ivr-1',
      name: 'Main menu',
      greetingPromptId: 'prompt-1',
      timeoutDestination: { type: 'hangup' },
      options: [{ digit: '1', destination: { type: 'extension', extensionId: 'ext-100' } }],
    });
    expect(ivr).toMatchObject({ timeoutSeconds: 5, maxRetries: 3, directDial: false });

    expect(
      createPrompt({ id: 'prompt-1', name: 'Welcome', kind: 'builtin', file: 'demo-congrats' }).kind,
    ).toBe('builtin');
  });

  it('rejects duplicate IVR digits and custom prompts outside custom/', () => {
    const destination = { type: 'hangup' as const };
    expect(() =>
      createIvr({
        id: 'ivr-2',
        name: 'Broken',
        greetingPromptId: 'prompt-1',
        timeoutDestination: destination,
        options: [
          { digit: '1', destination },
          { digit: '1', destination },
        ],
      }),
    ).toThrow(/unique/);
    expect(() =>
      createPrompt({ id: 'prompt-2', name: 'Bad', kind: 'custom', file: 'welcome' }),
    ).toThrow(/custom\//);
  });
});

describe('migrations', () => {
  it('accepts a current model', () => {
    const model = createDefaultModel({ now: '2026-01-02T03:04:05Z' });
    expect(migrateModel(model)).toEqual(model);
  });

  it('rejects a model from a newer release instead of guessing', () => {
    expect(() => migrateModel({ schemaVersion: 99 })).toThrow(ModelMigrationError);
  });

  it('rejects documents without a usable schema version', () => {
    expect(() => migrateModel(null)).toThrow(ModelMigrationError);
    expect(() => migrateModel({})).toThrow(ModelMigrationError);
    expect(() => migrateModel({ schemaVersion: 'one' })).toThrow(ModelMigrationError);
  });
});
