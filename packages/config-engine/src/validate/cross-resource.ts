import {
  isCidr,
  type Destination,
  type PbxModel,
} from '@better-pbx/shared';

import { detectOutboundPatternConflicts } from '../dialplan/conflicts.js';
import { cidrOverlaps } from '../policy/cidr.js';

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

function issue(code: string, path: string, message: string): ValidationIssue {
  return { code, path, message, severity: 'error' };
}

interface NamedValue {
  value: string;
  path: string;
}

function findDuplicates(values: NamedValue[], code: string, label: string): ValidationIssue[] {
  const seen = new Map<string, string>();
  const issues: ValidationIssue[] = [];
  for (const entry of values) {
    const earlier = seen.get(entry.value);
    if (earlier !== undefined) {
      issues.push(
        issue(code, entry.path, `${label} "${entry.value}" is already used at ${earlier}`),
      );
    } else {
      seen.set(entry.value, entry.path);
    }
  }
  return issues;
}

function destinationKey(destination: Destination): string {
  switch (destination.type) {
    case 'extension':
      return `extension:${destination.extensionId}`;
    case 'ringGroup':
      return `ringGroup:${destination.ringGroupId}`;
    case 'ivr':
      return `ivr:${destination.ivrId}`;
    case 'voicemail':
      return `voicemail:${destination.extensionId}`;
    case 'hangup':
      return 'hangup';
  }
}

function checkDestination(
  destination: Destination,
  path: string,
  model: PbxModel,
  issues: ValidationIssue[],
): void {
  switch (destination.type) {
    case 'extension': {
      if (!model.extensions.some((extension) => extension.id === destination.extensionId)) {
        issues.push(issue('unknown-destination', path, 'extension destination does not exist'));
      }
      break;
    }
    case 'ringGroup': {
      if (!model.ringGroups.some((group) => group.id === destination.ringGroupId)) {
        issues.push(issue('unknown-destination', path, 'ring group destination does not exist'));
      }
      break;
    }
    case 'ivr': {
      if (!model.ivrs.some((ivr) => ivr.id === destination.ivrId)) {
        issues.push(issue('unknown-destination', path, 'IVR destination does not exist'));
      }
      break;
    }
    case 'voicemail': {
      const extension = model.extensions.find((candidate) => candidate.id === destination.extensionId);
      if (extension === undefined) {
        issues.push(issue('unknown-destination', path, 'voicemail extension does not exist'));
      } else if (!extension.voicemail.enabled) {
        issues.push(
          issue('no-voicemail', path, 'voicemail destination points at an extension without a mailbox'),
        );
      }
      break;
    }
    case 'hangup':
      break;
  }
}

/** Build the graph of IVR/ring-group destinations and report any cycle with its path. */
function checkDestinationCycles(model: PbxModel, issues: ValidationIssue[]): void {
  const edges = new Map<string, Array<{ key: string; path: string }>>();
  const addEdge = (from: string, destination: Destination, path: string): void => {
    const list = edges.get(from) ?? [];
    list.push({ key: destinationKey(destination), path });
    edges.set(from, list);
  };

  for (const [index, group] of model.ringGroups.entries()) {
    addEdge(
      `ringGroup:${group.id}`,
      group.destinationIfNoAnswer,
      `ringGroups[${index}].destinationIfNoAnswer`,
    );
  }
  for (const [index, ivr] of model.ivrs.entries()) {
    const from = `ivr:${ivr.id}`;
    ivr.options.forEach((option, optionIndex) => {
      addEdge(from, option.destination, `ivrs[${index}].options[${optionIndex}].destination`);
    });
    addEdge(from, ivr.timeoutDestination, `ivrs[${index}].timeoutDestination`);
    if (ivr.invalidDestination !== undefined) {
      addEdge(from, ivr.invalidDestination, `ivrs[${index}].invalidDestination`);
    }
  }

  const nodePaths = new Map<string, string>();
  model.ringGroups.forEach((group, index) => nodePaths.set(`ringGroup:${group.id}`, `ringGroups[${index}]`));
  model.ivrs.forEach((ivr, index) => nodePaths.set(`ivr:${ivr.id}`, `ivrs[${index}]`));

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (key: string, originPath: string): void => {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      const cycleStart = stack.indexOf(key);
      const cycle = [...stack.slice(cycleStart), key].join(' -> ');
      issues.push(
        issue('destination-cycle', originPath, `destination cycle detected: ${cycle}`),
      );
      return;
    }
    visiting.add(key);
    stack.push(key);
    for (const edge of edges.get(key) ?? []) {
      visit(edge.key, edge.path);
    }
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };

  for (const key of edges.keys()) visit(key, nodePaths.get(key) ?? key);
}

function checkCrossResource(model: PbxModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const ids: NamedValue[] = [
    ...model.extensions.map((resource, index) => ({ value: resource.id, path: `extensions[${index}].id` })),
    ...model.trunks.map((resource, index) => ({ value: resource.id, path: `trunks[${index}].id` })),
    ...model.outboundRoutes.map((resource, index) => ({ value: resource.id, path: `outboundRoutes[${index}].id` })),
    ...model.inboundRoutes.map((resource, index) => ({ value: resource.id, path: `inboundRoutes[${index}].id` })),
    ...model.ringGroups.map((resource, index) => ({ value: resource.id, path: `ringGroups[${index}].id` })),
    ...model.ivrs.map((resource, index) => ({ value: resource.id, path: `ivrs[${index}].id` })),
    ...model.prompts.map((resource, index) => ({ value: resource.id, path: `prompts[${index}].id` })),
  ];
  issues.push(...findDuplicates(ids, 'duplicate-id', 'resource ID'));
  issues.push(
    ...findDuplicates(
      model.trunks.map((trunk, index) => ({ value: trunk.name, path: `trunks[${index}].name` })),
      'duplicate-trunk-name',
      'trunk name',
    ),
  );

  const dialableNumbers: NamedValue[] = [
    ...model.extensions.map((extension, index) => ({
      value: extension.number,
      path: `extensions[${index}].number`,
    })),
    ...model.ringGroups.map((group, index) => ({ value: group.number, path: `ringGroups[${index}].number` })),
    ...model.ivrs.flatMap((ivr, index) =>
      ivr.number === undefined ? [] : [{ value: ivr.number, path: `ivrs[${index}].number` }],
    ),
    ...model.settings.region.emergencyNumbers.map((number, index) => ({
      value: number,
      path: `settings.region.emergencyNumbers[${index}]`,
    })),
    ...model.outboundRoutes.flatMap((route, routeIndex) =>
      route.patterns
        .filter((pattern) => !pattern.match.startsWith('_'))
        .map((pattern, patternIndex) => ({
          value: pattern.match,
          path: `outboundRoutes[${routeIndex}].patterns[${patternIndex}].match`,
        })),
    ),
  ];
  issues.push(...findDuplicates(dialableNumbers, 'duplicate-number', 'dialable number'));

  const trunkIds = new Set(model.trunks.map((trunk) => trunk.id));
  model.outboundRoutes.forEach((route, index) => {
    if (!trunkIds.has(route.trunkId)) {
      issues.push(issue('unknown-trunk', `outboundRoutes[${index}].trunkId`, 'outbound route references an unknown trunk'));
    }
  });
  model.inboundRoutes.forEach((route, index) => {
    if (route.trunkId !== undefined && !trunkIds.has(route.trunkId)) {
      issues.push(issue('unknown-trunk', `inboundRoutes[${index}].trunkId`, 'inbound route references an unknown trunk'));
    }
    checkDestination(route.destination, `inboundRoutes[${index}].destination`, model, issues);
  });

  const promptIds = new Set(model.prompts.map((prompt) => prompt.id));
  const extensionById = new Map(model.extensions.map((extension) => [extension.id, extension]));
  for (const [index, group] of model.ringGroups.entries()) {
    group.memberIds.forEach((memberId, memberIndex) => {
      const extension = extensionById.get(memberId);
      if (extension === undefined) {
        issues.push(
          issue('unknown-member', `ringGroups[${index}].memberIds[${memberIndex}]`, 'ring group member does not exist'),
        );
      } else if (!extension.enabled) {
        issues.push(
          issue('disabled-member', `ringGroups[${index}].memberIds[${memberIndex}]`, 'ring group member is disabled'),
        );
      }
    });
    checkDestination(group.destinationIfNoAnswer, `ringGroups[${index}].destinationIfNoAnswer`, model, issues);
  }

  for (const [index, ivr] of model.ivrs.entries()) {
    if (!promptIds.has(ivr.greetingPromptId)) {
      issues.push(
        issue('unknown-prompt', `ivrs[${index}].greetingPromptId`, 'IVR greeting prompt does not exist'),
      );
    }
    ivr.options.forEach((option, optionIndex) => {
      checkDestination(option.destination, `ivrs[${index}].options[${optionIndex}].destination`, model, issues);
    });
    checkDestination(ivr.timeoutDestination, `ivrs[${index}].timeoutDestination`, model, issues);
    if (ivr.invalidDestination !== undefined) {
      checkDestination(ivr.invalidDestination, `ivrs[${index}].invalidDestination`, model, issues);
    }
  }

  const didKeys = new Map<string, string>();
  model.inboundRoutes.forEach((route, index) => {
    if (!route.enabled) return;
    const key = `${route.trunkId ?? '*'}:${route.did}`;
    const earlier = didKeys.get(key);
    if (earlier !== undefined) {
      issues.push(
        issue('duplicate-did', `inboundRoutes[${index}].did`, `DID is already routed at ${earlier}`),
      );
    } else {
      didKeys.set(key, `inboundRoutes[${index}]`);
    }
  });

  for (const [index, trunk] of model.trunks.entries()) {
    if (trunk.inboundMode !== 'ip') continue;
    for (const [cidrIndex, cidr] of trunk.providerCidrs.entries()) {
      if (!isCidr(cidr)) continue;
      for (const [blackIndex, black] of model.settings.security.blacklist.entries()) {
        if (cidrOverlaps(cidr, black)) {
          issues.push(
            issue(
              'trusted-and-blocked',
              `trunks[${index}].providerCidrs[${cidrIndex}]`,
              `provider CIDR overlaps blacklist entry settings.security.blacklist[${blackIndex}]`,
            ),
          );
        }
      }
    }
  }

  for (const conflict of detectOutboundPatternConflicts(model)) {
    const routeIndex = model.outboundRoutes.findIndex((route) => route.id === conflict.first.routeId);
    const patternIndex = conflict.first.patternIndex;
    issues.push(
      issue(
        'pattern-conflict',
        `outboundRoutes[${routeIndex}].patterns[${patternIndex}].match`,
        `${conflict.reason} ("${conflict.first.match}" and "${conflict.second.match}")`,
      ),
    );
  }

  checkDestinationCycles(model, issues);

  return issues;
}

/** Full cross-resource validation of an already-parsed model. */
export function validateCrossResource(model: PbxModel): ValidationIssue[] {
  return checkCrossResource(model);
}
