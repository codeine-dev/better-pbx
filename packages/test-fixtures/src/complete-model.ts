import {
  createDefaultModel,
  createExtension,
  createInboundRoute,
  createIvr,
  createOutboundRoute,
  createPrompt,
  createRingGroup,
  createTrunk,
  type PbxModel,
} from '@better-pbx/shared';

/**
 * The complete, safe fixture that exercises every feature in the model. It is imported by the
 * config-engine golden tests and the security policy tests, so every feature is validated by the
 * same source of truth. Timestamps and IDs are fixed for deterministic output.
 */
export function buildCompleteModel(): PbxModel {
  const base = createDefaultModel({ now: '2026-01-02T03:04:05Z' });
  return {
    ...base,
    meta: { ...base.meta, pbxName: 'Acme PBX' },
    settings: {
      ...base.settings,
      region: {
        ...base.settings.region,
        country: 'GB',
        timezone: 'Europe/London',
        emergencyNumbers: ['999', '112'],
      },
      network: {
        ...base.settings.network,
        externalAddress: 'sip.example.net',
        rtpStart: 12000,
        rtpEnd: 13000,
        tlsEnabled: true,
      },
      security: {
        ...base.settings.security,
        fail2ban: { maxRetry: 4, findTime: 300, banTime: 7200, increment: true },
        whitelist: ['203.0.113.0/24'],
        blacklist: ['192.0.2.7/32'],
      },
      voicemail: { maxMessages: 50, maxSeconds: 120, defaultPinLength: 6 },
    },
    prompts: [
      createPrompt({
        id: 'prompt-welcome',
        name: 'Welcome',
        kind: 'custom',
        file: 'custom/welcome',
        originalName: 'welcome.wav',
        durationMs: 4200,
      }),
      createPrompt({
        id: 'prompt-builtin',
        name: 'Congratulations',
        kind: 'builtin',
        file: 'demo-congrats',
      }),
    ],
    extensions: [
      createExtension({
        id: 'ext-100',
        number: '100',
        displayName: 'Alice',
        secret: 'alice-super-secret',
        transport: 'tls',
        callerId: '100',
        voicemail: { enabled: true, pin: '4821', email: 'alice@example.com' },
      }),
      createExtension({
        id: 'ext-101',
        number: '101',
        displayName: 'Bob',
        secret: 'bob-super-secret',
        codecs: ['g722', 'ulaw'],
      }),
      createExtension({
        id: 'ext-102',
        number: '102',
        displayName: 'Disabled',
        secret: 'disabled-secret',
        enabled: false,
      }),
    ],
    trunks: [
      createTrunk({
        id: 'trunk-primary',
        name: 'primary',
        host: 'sip.provider.example',
        username: 'acme',
        password: 'provider-secret',
        fromUser: '15551230000',
        fromDomain: 'sip.provider.example',
        callerId: '15551230000',
        inboundMode: 'registration',
      }),
      createTrunk({
        id: 'trunk-backup',
        name: 'backup',
        host: '198.51.100.20',
        codecs: ['gsm', 'ulaw'],
        inboundMode: 'ip',
        providerCidrs: ['198.51.100.0/24'],
      }),
      createTrunk({
        id: 'trunk-spare',
        name: 'spare',
        host: '203.0.113.50',
        username: 'spare',
        password: 'spare-secret-123',
        enabled: false,
      }),
    ],
    outboundRoutes: [
      createOutboundRoute({
        id: 'route-emergency',
        name: 'US emergency',
        priority: 10,
        trunkId: 'trunk-primary',
        patterns: [{ match: '_911', strip: 0, prepend: '' }],
      }),
      createOutboundRoute({
        id: 'route-national',
        name: 'National',
        priority: 100,
        trunkId: 'trunk-primary',
        patterns: [{ match: '_1[2-8]XXNXXXXXX', strip: 1, prepend: '1' }],
      }),
      createOutboundRoute({
        id: 'route-backup',
        name: 'Backup',
        priority: 200,
        trunkId: 'trunk-backup',
        callerId: '15551230000',
        allowPremium: true,
        patterns: [{ match: '_00X.', strip: 2, prepend: '+' }],
      }),
    ],
    ringGroups: [
      createRingGroup({
        id: 'rg-sales',
        name: 'Sales',
        number: '600',
        strategy: 'rrmemory',
        memberIds: ['ext-100', 'ext-101'],
        ringTime: 25,
        destinationIfNoAnswer: { type: 'voicemail', extensionId: 'ext-100' },
      }),
      createRingGroup({
        id: 'rg-support',
        name: 'Support',
        number: '601',
        strategy: 'linear',
        memberIds: ['ext-101', 'ext-100'],
        ringTime: 15,
        destinationIfNoAnswer: { type: 'hangup' },
      }),
    ],
    ivrs: [
      createIvr({
        id: 'ivr-main',
        name: 'Main menu',
        number: '700',
        greetingPromptId: 'prompt-welcome',
        timeoutSeconds: 6,
        maxRetries: 2,
        options: [
          { digit: '1', destination: { type: 'ringGroup', ringGroupId: 'rg-sales' } },
          { digit: '2', destination: { type: 'voicemail', extensionId: 'ext-100' } },
        ],
        timeoutDestination: { type: 'extension', extensionId: 'ext-101' },
        invalidDestination: { type: 'hangup' },
        directDial: true,
      }),
      createIvr({
        id: 'ivr-after-hours',
        name: 'After hours',
        greetingPromptId: 'prompt-builtin',
        timeoutSeconds: 3,
        maxRetries: 1,
        timeoutDestination: { type: 'hangup' },
        directDial: false,
      }),
    ],
    inboundRoutes: [
      createInboundRoute({
        id: 'inbound-primary',
        name: 'Primary DID',
        did: '15551230000',
        trunkId: 'trunk-primary',
        destination: { type: 'ivr', ivrId: 'ivr-main' },
        callerIdFilter: '^[+]?1?555',
      }),
      createInboundRoute({
        id: 'inbound-generic',
        name: 'Generic DID',
        did: '15559876543',
        destination: { type: 'extension', extensionId: 'ext-101' },
      }),
    ],
  };
}
