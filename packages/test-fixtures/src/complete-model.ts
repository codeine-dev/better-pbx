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
        localNetworks: ['192.168.10.0/24'],
        tlsEnabled: true,
      },
      security: {
        ...base.settings.security,
        whitelist: ['203.0.113.0/24'],
        blacklist: ['192.0.2.7/32'],
      },
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
        inboundMode: 'ip',
        providerCidrs: ['198.51.100.0/24'],
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
