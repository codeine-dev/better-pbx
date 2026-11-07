import { describe, expect, it } from 'vitest';

import { createDefaultModel, createOutboundRoute, type PbxModel } from '@better-pbx/shared';
import { buildCompleteModel } from '@better-pbx/test-fixtures';

import {
  DialplanPatternError,
  detectOutboundPatternConflicts,
  emergencyDialplanEntries,
  isCatchAllPattern,
  parseDialplanPattern,
  patternMatches,
  patternSamples,
  patternsMayOverlap,
  primaryOutboundTrunk,
} from './index.js';

describe('dialplan pattern parser', () => {
  it('parses literals and character classes', () => {
    expect(parseDialplanPattern('911').kind).toBe('literal');
    expect(patternMatches('911', '911')).toBe(true);
    expect(patternMatches('911', '912')).toBe(false);
    expect(patternMatches('_1[2-5]X', '135')).toBe(true);
    expect(patternMatches('_1[2-5]X', '165')).toBe(false);
  });

  it('implements X, Z, N, and range semantics', () => {
    expect(patternMatches('_X', '0')).toBe(true);
    expect(patternMatches('_Z', '0')).toBe(false);
    expect(patternMatches('_Z', '5')).toBe(true);
    expect(patternMatches('_N', '1')).toBe(false);
    expect(patternMatches('_N', '5')).toBe(true);
    expect(patternMatches('_1NXXNXXXXXX', '15555234567')).toBe(true);
    expect(patternMatches('_1NXXNXXXXXX', '10551234567')).toBe(false);
  });

  it('supports trailing . and ! wildcards', () => {
    expect(patternMatches('_00X.', '001234')).toBe(true);
    expect(patternMatches('_00X.', '001')).toBe(false);
    expect(patternMatches('_X!', '5')).toBe(true);
    expect(patternMatches('_X!', '')).toBe(false);
    expect(patternMatches('_1!', '1')).toBe(true);
  });

  it('rejects malformed or unsafe patterns', () => {
    expect(() => parseDialplanPattern('_X.Z')).toThrow(DialplanPatternError);
    expect(() => parseDialplanPattern('_!X')).toThrow(DialplanPatternError);
    expect(() => parseDialplanPattern('_[1-')).toThrow(DialplanPatternError);
    expect(() => parseDialplanPattern('_1(2')).toThrow(DialplanPatternError);
    expect(() => parseDialplanPattern('12a')).toThrow(DialplanPatternError);
  });

  it('classifies catch-all patterns', () => {
    for (const pattern of ['_.', '_X.', '_X!', '_[0-9].', '_!']) {
      expect(isCatchAllPattern(pattern)).toBe(true);
    }
    expect(isCatchAllPattern('_1X.')).toBe(false);
    expect(isCatchAllPattern('_1NXXNXXXXXX')).toBe(false);
  });

  it('generates representative samples and detects overlapping patterns', () => {
    const samples = patternSamples('_1NXXNXXXXXX');
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every((sample) => patternMatches('_1NXXNXXXXXX', sample))).toBe(true);
    expect(patternsMayOverlap('_1NXXNXXXXXX', '15555234567')).toBe(true);
    expect(patternsMayOverlap('_1NXXNXXXXXX', '_19XXXXXXXXX')).toBe(true);
    expect(patternsMayOverlap('_00X.', '_011X.')).toBe(false);
    expect(patternsMayOverlap('_1NXXNXXXXXX', '_00X.')).toBe(false);
  });
});

describe('conflict detection', () => {
  it('finds no conflicts in the complete fixture', () => {
    expect(detectOutboundPatternConflicts(buildCompleteModel())).toEqual([]);
  });

  it('finds duplicate and ambiguous outbound patterns', () => {
    const model = buildCompleteModel();
    const conflicting: PbxModel = {
      ...model,
      outboundRoutes: [
        ...model.outboundRoutes,
        createOutboundRoute({
          id: 'route-conflict',
          name: 'Conflict',
          priority: 300,
          trunkId: 'trunk-backup',
          patterns: [{ match: '_1[2-8]XXNXXXXXX', strip: 0, prepend: '' }],
        }),
      ],
    };
    const conflicts = detectOutboundPatternConflicts(conflicting);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.reason).toBe('duplicate outbound pattern');
  });
});

describe('emergency routes', () => {
  it('uses the highest-priority enabled trunk', () => {
    expect(primaryOutboundTrunk(buildCompleteModel())?.name).toBe('primary');
    const entries = emergencyDialplanEntries(buildCompleteModel());
    expect(entries).toContain('exten => 999,1,NoOp(Emergency call 999 via primary)');
    expect(entries).toContain('exten => 112,1,NoOp(Emergency call 112 via primary)');
    expect(entries.join('\n')).toContain('Dial(PJSIP/${EXTEN}@trunk-trunk-primary,120)');
  });

  it('fails closed when no trunk exists', () => {
    const entries = emergencyDialplanEntries(createDefaultModel()).join('\n');
    expect(entries).toContain('Playback(ss-noservice)');
    expect(entries).not.toContain('Dial(');
  });
});
