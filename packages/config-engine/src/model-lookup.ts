import type {
  Destination,
  Extension,
  Ivr,
  PbxModel,
  Prompt,
  RingGroup,
  Trunk,
} from '@better-pbx/shared';

export interface ModelLookup {
  model: PbxModel;
  extensionsById: ReadonlyMap<string, Extension>;
  extensionsByNumber: ReadonlyMap<string, Extension>;
  trunksById: ReadonlyMap<string, Trunk>;
  ringGroupsById: ReadonlyMap<string, RingGroup>;
  ivrsById: ReadonlyMap<string, Ivr>;
  promptsById: ReadonlyMap<string, Prompt>;
}

export function createLookup(model: PbxModel): ModelLookup {
  return {
    model,
    extensionsById: new Map(model.extensions.map((extension) => [extension.id, extension])),
    extensionsByNumber: new Map(model.extensions.map((extension) => [extension.number, extension])),
    trunksById: new Map(model.trunks.map((trunk) => [trunk.id, trunk])),
    ringGroupsById: new Map(model.ringGroups.map((group) => [group.id, group])),
    ivrsById: new Map(model.ivrs.map((ivr) => [ivr.id, ivr])),
    promptsById: new Map(model.prompts.map((prompt) => [prompt.id, prompt])),
  };
}

/**
 * Dialplan actions that hand a call to a destination. References are resolved rather than trusted:
 * rendering an unknown ID is a programming error, not something to paper over with a silent hangup.
 */
export function destinationActions(destination: Destination, lookup: ModelLookup): string[] {
  switch (destination.type) {
    case 'extension': {
      const extension = lookup.extensionsById.get(destination.extensionId);
      if (!extension) throw new Error(`unknown extension ${destination.extensionId}`);
      return [`Goto(internal,${extension.number},1)`];
    }
    case 'ringGroup': {
      const group = lookup.ringGroupsById.get(destination.ringGroupId);
      if (!group) throw new Error(`unknown ring group ${destination.ringGroupId}`);
      return [`Goto(internal,${group.number},1)`];
    }
    case 'ivr': {
      const ivr = lookup.ivrsById.get(destination.ivrId);
      if (!ivr) throw new Error(`unknown IVR ${destination.ivrId}`);
      return ivr.number === undefined
        ? [`Goto(ivr-${ivr.id},s,1)`]
        : [`Goto(internal,${ivr.number},1)`];
    }
    case 'voicemail': {
      const extension = lookup.extensionsById.get(destination.extensionId);
      if (!extension) throw new Error(`unknown voicemail extension ${destination.extensionId}`);
      return [`VoiceMail(${extension.number}@default,u)`];
    }
    case 'hangup':
      return ['Hangup()'];
  }
}

/** PJSIP endpoint name for an extension. IDs are used so renumbering does not change auth names. */
export function extensionEndpoint(id: string): string {
  return `endpoint-${id}`;
}

export function extensionAor(id: string): string {
  return `aor-${id}`;
}

export function extensionAuth(id: string): string {
  return `auth-${id}`;
}

export function trunkEndpoint(id: string): string {
  return `trunk-${id}`;
}

export function trunkAor(id: string): string {
  return `trunk-aor-${id}`;
}

export function trunkAuth(id: string): string {
  return `trunk-auth-${id}`;
}

export function trunkRegistration(id: string): string {
  return `trunk-reg-${id}`;
}

export function trunkIdentify(id: string): string {
  return `trunk-identify-${id}`;
}

export function queueName(id: string): string {
  return `queue-${id}`;
}

export function ivrContext(id: string): string {
  return `ivr-${id}`;
}

export function trunkContext(id: string): string {
  return `from-trunk-${id}`;
}
