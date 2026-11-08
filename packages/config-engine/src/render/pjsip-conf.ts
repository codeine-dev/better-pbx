import type { Extension, PbxModel, Trunk } from '@better-pbx/shared';

import { renderConfig, type ConfigSection } from './config-format.js';
import {
  extensionAor,
  extensionAuth,
  extensionEndpoint,
  trunkAor,
  trunkAuth,
  trunkEndpoint,
  trunkIdentify,
  trunkRegistration,
} from '../model-lookup.js';
import type { RenderPaths } from './types.js';

function codecLines(codecs: readonly string[]): string[] {
  return ['disallow = all', ...codecs.map((codec) => `allow = ${codec}`)];
}

function extensionSections(extension: Extension, mediaMode: 'none' | 'sdes' | 'dtls', certPath: string): ConfigSection[] {
  if (!extension.enabled) return [];

  const transport = extension.transport === 'tls' ? 'transport-tls' : 'transport-udp';
  const callerId = extension.callerId ?? extension.number;
  const name = extension.displayName.replace(/["\r\n]/g, ' ').trim();

  return [
    {
      name: extensionAuth(extension.id),
      lines: [
        'type = auth',
        'auth_type = userpass',
        `username = ${extension.number}`,
        `password = ${extension.secret}`,
      ],
    },
    {
      name: extensionAor(extension),
      lines: [
        'type = aor',
        `max_contacts = ${extension.maxContacts}`,
        'remove_existing = yes',
        'qualify_frequency = 30',
        'maximum_expiration = 3600',
        'minimum_expiration = 60',
        'default_expiration = 600',
      ],
    },
    {
      name: extensionEndpoint(extension),
      lines: [
        'type = endpoint',
        `transport = ${transport}`,
        'context = internal',
        ...codecLines(extension.codecs),
        `auth = ${extensionAuth(extension.id)}`,
        `aors = ${extensionAor(extension)}`,
        `callerid = "${name}" <${callerId}>`,
        'acl = global-acl',
        'direct_media = no',
        'rtp_symmetric = yes',
        'force_rport = yes',
        'rewrite_contact = yes',
        'ice_support = no',
        ...(mediaMode === 'sdes' ? ['media_encryption = sdes', 'media_encryption_optimistic = no'] : []),
        ...(mediaMode === 'dtls'
          ? [
              'media_encryption = dtls',
              'media_encryption_optimistic = no',
              'dtls_verify = fingerprint',
              'dtls_setup = actpass',
              `dtls_cert_file = ${certPath}/sip.crt`,
              `dtls_private_key = ${certPath}/sip.key`,
            ]
          : []),
        'allow_transfer = yes',
        `allow_subscribe = ${extension.voicemail.enabled ? 'yes' : 'no'}`,
        'send_rpid = no',
        'identify_by = auth_username,username,ip',
        ...(extension.voicemail.enabled ? [`mailboxes = ${extension.number}@default`] : []),
      ],
    },
  ];
}

function trunkSections(trunk: Trunk, mediaMode: 'none' | 'sdes' | 'dtls', certPath: string): ConfigSection[] {
  if (!trunk.enabled) return [];

  const transport = trunk.transport === 'tls' ? 'transport-tls' : 'transport-udp';
  const hasCredentials = trunk.username !== undefined && trunk.password !== undefined;
  const sections: ConfigSection[] = [];

  if (hasCredentials) {
    sections.push({
      name: trunkAuth(trunk.id),
      lines: [
        'type = auth',
        'auth_type = userpass',
        `username = ${trunk.username}`,
        `password = ${trunk.password}`,
      ],
    });
  }

  sections.push({
    name: trunkAor(trunk.id),
    lines: [
      'type = aor',
      `contact = sip:${trunk.host}:${trunk.port}`,
      'qualify_frequency = 60',
      'maximum_expiration = 3600',
      'minimum_expiration = 60',
      'default_expiration = 600',
    ],
  });

  sections.push({
    name: trunkEndpoint(trunk.id),
    lines: [
      'type = endpoint',
      `transport = ${transport}`,
      `context = from-trunk-${trunk.id}`,
      ...codecLines(trunk.codecs),
      `aors = ${trunkAor(trunk.id)}`,
      ...(hasCredentials ? [`outbound_auth = ${trunkAuth(trunk.id)}`] : []),
      ...(trunk.inboundMode === 'registration' && hasCredentials
        ? [`auth = ${trunkAuth(trunk.id)}`]
        : []),
      ...(trunk.fromUser === undefined ? [] : [`from_user = ${trunk.fromUser}`]),
      ...(trunk.fromDomain === undefined ? [] : [`from_domain = ${trunk.fromDomain}`]),
      ...(trunk.callerId === undefined ? [] : [`callerid = ${trunk.callerId}`]),
      'acl = global-acl',
      'direct_media = no',
      'rtp_symmetric = yes',
      'force_rport = yes',
      'rewrite_contact = yes',
      'ice_support = no',
      ...(mediaMode === 'sdes' ? ['media_encryption = sdes', 'media_encryption_optimistic = no'] : []),
      ...(mediaMode === 'dtls'
        ? [
            'media_encryption = dtls',
            'media_encryption_optimistic = no',
            'dtls_verify = fingerprint',
            'dtls_setup = actpass',
            `dtls_cert_file = ${certPath}/sip.crt`,
            `dtls_private_key = ${certPath}/sip.key`,
          ]
        : []),
      'send_pai = yes',
      'send_rpid = no',
      'identify_by = ip,auth_username,username',
    ],
  });

  if (trunk.inboundMode === 'registration' && hasCredentials) {
    const clientDomain = trunk.fromDomain ?? trunk.host;
    sections.push({
      name: trunkRegistration(trunk.id),
      lines: [
        'type = registration',
        `transport = ${transport}`,
        `server_uri = sip:${trunk.host}:${trunk.port}`,
        `client_uri = sip:${trunk.username}@${clientDomain}`,
        `contact_user = ${trunk.username}`,
        `outbound_auth = ${trunkAuth(trunk.id)}`,
        'retry_interval = 60',
        'forbidden_retry_interval = 600',
        'expiration = 3600',
        'max_retries = 10',
      ],
    });
  }

  if (trunk.inboundMode === 'ip') {
    sections.push({
      name: trunkIdentify(trunk.id),
      lines: [
        'type = identify',
        `endpoint = ${trunkEndpoint(trunk.id)}`,
        ...trunk.providerCidrs.map((cidr) => `match = ${cidr}`),
      ],
    });
  }

  return sections;
}

/**
 * PJSIP configuration. There are never anonymous endpoints: every extension endpoint has an auth
 * object, and a trunk is either authenticated by registration credentials or matched to a specific
 * provider CIDR.
 */
export function renderPjsipConf(model: PbxModel, paths: RenderPaths): string {
  if (model.settings.network.tlsEnabled === false) {
    for (const extension of model.extensions) {
      if (extension.enabled && extension.transport === 'tls') {
        throw new Error(`extension ${extension.number} uses TLS but SIP TLS is disabled`);
      }
    }
    for (const trunk of model.trunks) {
      if (trunk.enabled && trunk.transport === 'tls') {
        throw new Error(`trunk ${trunk.name} uses TLS but SIP TLS is disabled`);
      }
    }
  }

  const sections: ConfigSection[] = [
    {
      name: 'global',
      lines: [
        'type = global',
        'endpoint_identifier_order = ip,username,auth_username',        'max_forwards = 70',
        'user_agent = BetterPBX',
      ],
    },
    {
      name: 'transport-udp',
      lines: [
        'type = transport',
        'protocol = udp',
        `bind = 0.0.0.0:${model.settings.network.sipPort}`,
        'allow_reload = yes',
      ],
    },
  ];

  if (model.settings.network.tlsEnabled) {
    const tlsLines = [
      'type = transport',
      'protocol = tls',
    ];
    if (model.settings.network.tlsMethod) tlsLines.push(`method = ${model.settings.network.tlsMethod}`);
    tlsLines.push(`bind = 0.0.0.0:${model.settings.network.tlsPort}`);
    tlsLines.push(`cert_file = ${paths.dataDir}/runtime/tls/sip.crt`);
    tlsLines.push(`priv_key_file = ${paths.dataDir}/runtime/tls/sip.key`);
    if (model.settings.network.tlsCipher) tlsLines.push(`cipher = ${model.settings.network.tlsCipher}`);
    tlsLines.push('verify_client = no', 'require_client_cert = no', 'allow_reload = yes');
    sections.push({
      name: 'transport-tls',
      lines: tlsLines,
    });
  }

  const mediaMode: 'none' | 'sdes' | 'dtls' = model.settings.network.dtlsSrtpEnabled
    ? 'dtls'
    : model.settings.network.srtpEnabled
      ? 'sdes'
      : 'none';

  const extensions = model.extensions
    .slice()
    .sort((a, b) => a.number.localeCompare(b.number, 'en'));
  for (const extension of extensions) {
    sections.push(...extensionSections(extension, mediaMode, `${paths.dataDir}/runtime/tls`));
  }

  const trunks = model.trunks.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const trunk of trunks) {
    sections.push(...trunkSections(trunk, mediaMode, `${paths.dataDir}/runtime/tls`));
  }

  return renderConfig(
    [
      'BetterPBX PJSIP configuration.',
      '',
      'Generated from the typed model. Every endpoint authenticates; no shared or unidentified',
      'endpoint exists. Legacy chan_sip is not built or configured.',
    ],
    sections,
  );
}
