import type { Destination } from './destinations.js';
import { CONFIG_SCHEMA_VERSION, pbxModelSchema, type PbxModel } from './model.js';
import { randomToken } from './random.js';
import {
  extensionSchema,
  inboundRouteSchema,
  ivrSchema,
  outboundRouteSchema,
  promptSchema,
  ringGroupSchema,
  trunkSchema,
  type Extension,
  type InboundRoute,
  type Ivr,
  type Mailbox,
  type OutboundPattern,
  type OutboundRoute,
  type Prompt,
  type RingGroup,
  type Trunk,
  type TrunkInboundMode,
} from './resources.js';
import { settingsSchema, type Settings } from './settings.js';

/** A strong SIP password that stays within the model's character rules. */
export function generateSipSecret(): string {
  return randomToken(24, 'base64url');
}

export function generateVoicemailPin(length = 4): string {
  return randomToken(length, 'numeric');
}

export function generateResourceId(): string {
  return globalThis.crypto.randomUUID();
}

/** Fully populated defaults. Parsing through the schema keeps this honest as fields are added. */
export function createDefaultSettings(): Settings {
  return settingsSchema.parse({});
}

export interface CreateDefaultModelOptions {
  pbxName?: string;
  /** Injected for deterministic fixtures and tests. */
  now?: string;
}

export function createDefaultModel(options: CreateDefaultModelOptions = {}): PbxModel {
  const now = options.now ?? new Date().toISOString();
  return pbxModelSchema.parse({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    meta: {
      pbxName: options.pbxName ?? 'BetterPBX',
      createdAt: now,
      updatedAt: now,
    },
    settings: {},
    extensions: [],
    trunks: [],
    outboundRoutes: [],
    inboundRoutes: [],
    ringGroups: [],
    ivrs: [],
    prompts: [],
  });
}

type ExtensionExtras = Partial<Omit<Extension, 'id' | 'number' | 'displayName' | 'secret' | 'voicemail'>>;
export type CreateExtensionInput = ExtensionExtras & {
  id?: string;
  number: string;
  displayName?: string;
  secret?: string;
  voicemail?: Partial<Mailbox>;
};

export function createExtension(input: CreateExtensionInput): Extension {
  const { id, number, displayName, secret, voicemail, ...rest } = input;
  return extensionSchema.parse({
    id: id ?? generateResourceId(),
    number,
    displayName: displayName ?? `Extension ${number}`,
    secret: secret ?? generateSipSecret(),
    ...rest,
    voicemail: { enabled: false, ...voicemail },
  });
}

type TrunkExtras = Partial<Omit<Trunk, 'id' | 'name' | 'host' | 'inboundMode' | 'providerCidrs'>>;
export type CreateTrunkInput = TrunkExtras & {
  id?: string;
  name: string;
  host: string;
  inboundMode?: TrunkInboundMode;
  providerCidrs?: string[];
};

export function createTrunk(input: CreateTrunkInput): Trunk {
  const { id, name, host, inboundMode, providerCidrs, ...rest } = input;
  return trunkSchema.parse({
    id: id ?? generateResourceId(),
    name,
    host,
    ...rest,
    inboundMode: inboundMode ?? 'registration',
    providerCidrs: providerCidrs ?? [],
  });
}

type OutboundRouteExtras = Partial<Omit<OutboundRoute, 'id' | 'name' | 'trunkId' | 'patterns'>>;
export type CreateOutboundRouteInput = OutboundRouteExtras & {
  id?: string;
  name: string;
  trunkId: string;
  patterns: OutboundPattern[];
};

export function createOutboundRoute(input: CreateOutboundRouteInput): OutboundRoute {
  const { id, name, trunkId, patterns, ...rest } = input;
  return outboundRouteSchema.parse({
    id: id ?? generateResourceId(),
    name,
    trunkId,
    patterns,
    ...rest,
  });
}

type InboundRouteExtras = Partial<Omit<InboundRoute, 'id' | 'name' | 'did' | 'destination'>>;
export type CreateInboundRouteInput = InboundRouteExtras & {
  id?: string;
  name: string;
  did: string;
  destination: Destination;
};

export function createInboundRoute(input: CreateInboundRouteInput): InboundRoute {
  const { id, name, did, destination, ...rest } = input;
  return inboundRouteSchema.parse({
    id: id ?? generateResourceId(),
    name,
    did,
    destination,
    ...rest,
  });
}

type RingGroupExtras = Partial<Omit<RingGroup, 'id' | 'name' | 'number' | 'memberIds' | 'destinationIfNoAnswer'>>;
export type CreateRingGroupInput = RingGroupExtras & {
  id?: string;
  name: string;
  number: string;
  memberIds: string[];
  destinationIfNoAnswer: Destination;
};

export function createRingGroup(input: CreateRingGroupInput): RingGroup {
  const { id, name, number, memberIds, destinationIfNoAnswer, ...rest } = input;
  return ringGroupSchema.parse({
    id: id ?? generateResourceId(),
    name,
    number,
    memberIds,
    destinationIfNoAnswer,
    ...rest,
  });
}

type IvrExtras = Partial<Omit<Ivr, 'id' | 'name' | 'greetingPromptId' | 'timeoutDestination'>>;
export type CreateIvrInput = IvrExtras & {
  id?: string;
  name: string;
  greetingPromptId: string;
  timeoutDestination: Destination;
};

export function createIvr(input: CreateIvrInput): Ivr {
  const { id, name, greetingPromptId, timeoutDestination, ...rest } = input;
  return ivrSchema.parse({
    id: id ?? generateResourceId(),
    name,
    greetingPromptId,
    timeoutDestination,
    ...rest,
  });
}

type PromptExtras = Partial<Omit<Prompt, 'id' | 'name' | 'kind' | 'file'>>;
export type CreatePromptInput = PromptExtras & {
  id?: string;
  name: string;
  kind: Prompt['kind'];
  file: string;
};

export function createPrompt(input: CreatePromptInput): Prompt {
  const { id, name, kind, file, ...rest } = input;
  return promptSchema.parse({
    id: id ?? generateResourceId(),
    name,
    kind,
    file,
    ...rest,
  });
}
