import type { OutboundRoute, PbxModel, Trunk } from '@better-pbx/shared';

import { patternsMayOverlap } from './pattern.js';

export interface PatternConflict {
  first: { routeId: string; routeName: string; patternIndex: number; match: string };
  second: { routeId: string; routeName: string; patternIndex: number; match: string };
  reason: string;
}

interface PatternLocation {
  routeId: string;
  routeName: string;
  patternIndex: number;
  match: string;
}

/** Highest-priority enabled trunk, used for emergency calls. */
export function primaryOutboundTrunk(model: PbxModel): Trunk | undefined {
  const route = model.outboundRoutes
    .filter((candidate) => candidate.enabled)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'en'))[0];
  if (route === undefined) return undefined;
  const trunk = model.trunks.find((candidate) => candidate.id === route.trunkId);
  return trunk?.enabled ? trunk : undefined;
}

function collectPatterns(routes: OutboundRoute[]): PatternLocation[] {
  const result: PatternLocation[] = [];
  for (const route of routes) {
    route.patterns.forEach((pattern, patternIndex) => {
      result.push({
        routeId: route.id,
        routeName: route.name,
        patternIndex,
        match: pattern.match,
      });
    });
  }
  return result;
}

/**
 * Find outbound patterns that can match the same dialled number. Overlapping patterns make the
 * resulting route ambiguous, so conflicts must be resolved before the model can be applied.
 */
export function detectOutboundPatternConflicts(model: PbxModel): PatternConflict[] {
  const routes = model.outboundRoutes
    .filter((route) => route.enabled)
    .slice()
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'en'));
  const patterns = collectPatterns(routes);
  const conflicts: PatternConflict[] = [];

  for (let firstIndex = 0; firstIndex < patterns.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < patterns.length; secondIndex += 1) {
      const first = patterns[firstIndex];
      const second = patterns[secondIndex];
      if (first === undefined || second === undefined) continue;
      if (patternsMayOverlap(first.match, second.match)) {
        conflicts.push({
          first,
          second,
          reason:
            first.match === second.match
              ? 'duplicate outbound pattern'
              : 'outbound patterns can match the same dialled number',
        });
      }
    }
  }

  return conflicts;
}
