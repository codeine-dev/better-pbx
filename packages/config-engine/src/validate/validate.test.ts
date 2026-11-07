import { describe, expect, it } from 'vitest';

import {
  createDefaultModel,
  createExtension,
  createIvr,
  createOutboundRoute,
  createPrompt,
  createRingGroup,
  createTrunk,
  type PbxModel,
} from '@better-pbx/shared';
import { buildCompleteModel } from '@better-pbx/test-fixtures';

import {
  ModelValidationError,
  assertValidModel,
  validateModel,
} from './index.js';

describe('cross-resource validation', () => {
  it('accepts the complete fixture', () => {
    const result = validateModel(buildCompleteModel());
    expect(result.issues).toEqual([]);
    expect(result.model).not.toBeNull();
    expect(() => assertValidModel(buildCompleteModel())).not.toThrow();
  });

  it('rejects duplicate IDs, numbers, and trunk names', () => {
    const model = buildCompleteModel();
    const broken: PbxModel = {
      ...model,
      extensions: [model.extensions[0]!, createExtension({ id: 'ext-100', number: '100', secret: 'another-secret' })],
      ringGroups: [
        model.ringGroups[0]!,
        createRingGroup({
          id: 'rg-second',
          name: 'Second',
          number: '100',
          memberIds: ['ext-100'],
          destinationIfNoAnswer: { type: 'hangup' },
        }),
      ],
      trunks: [
        model.trunks[0]!,
        createTrunk({ id: 'trunk-third', name: 'primary', host: '198.51.100.30' }),
      ],
    };
    const codes = validateModel(broken).issues.map((entry) => entry.code);
    expect(codes).toContain('duplicate-id');
    expect(codes).toContain('duplicate-number');
    expect(codes).toContain('duplicate-trunk-name');
  });

  it('rejects unknown references', () => {
    const model = buildCompleteModel();
    const broken: PbxModel = {
      ...model,
      outboundRoutes: [
        model.outboundRoutes[0]!,
        createOutboundRoute({
          id: 'route-bad',
          name: 'Bad',
          trunkId: 'trunk-missing',
          patterns: [{ match: '_2XXXXXX', strip: 0, prepend: '' }],
        }),
      ],
      inboundRoutes: [
        {
          ...model.inboundRoutes[0]!,
          id: 'inbound-bad',
          trunkId: 'trunk-missing',
          destination: { type: 'extension', extensionId: 'ext-missing' },
        },
      ],
      ringGroups: [
        {
          ...model.ringGroups[0]!,
          memberIds: ['ext-missing'],
        },
      ],
      ivrs: [
        {
          ...model.ivrs[0]!,
          greetingPromptId: 'prompt-missing',
        },
      ],
    };
    const codes = validateModel(broken).issues.map((entry) => entry.code);
    expect(codes).toContain('unknown-trunk');
    expect(codes).toContain('unknown-destination');
    expect(codes).toContain('unknown-member');
    expect(codes).toContain('unknown-prompt');
  });

  it('rejects voicemail destinations without a mailbox', () => {
    const model = buildCompleteModel();
    const broken: PbxModel = {
      ...model,
      inboundRoutes: [
        {
          ...model.inboundRoutes[0]!,
          destination: { type: 'voicemail', extensionId: 'ext-101' },
        },
      ],
    };
    expect(validateModel(broken).issues.some((entry) => entry.code === 'no-voicemail')).toBe(true);
  });

  it('detects IVR and ring-group destination cycles', () => {
    const base = createDefaultModel();
    const cyclic: PbxModel = {
      ...base,
      extensions: [
        createExtension({ id: 'ext-1', number: '100', secret: 'valid-secret-123' }),
      ],
      prompts: [
        createPrompt({ id: 'prompt-1', name: 'Greeting', kind: 'builtin', file: 'demo-congrats' }),
      ],
      ivrs: [
        createIvr({
          id: 'ivr-a',
          name: 'A',
          greetingPromptId: 'prompt-1',
          timeoutDestination: { type: 'ivr', ivrId: 'ivr-b' },
        }),
        createIvr({
          id: 'ivr-b',
          name: 'B',
          greetingPromptId: 'prompt-1',
          timeoutDestination: { type: 'ivr', ivrId: 'ivr-a' },
        }),
      ],
      ringGroups: [
        createRingGroup({
          id: 'rg-self',
          name: 'Self',
          number: '600',
          memberIds: ['ext-1'],
          destinationIfNoAnswer: { type: 'ringGroup', ringGroupId: 'rg-self' },
        }),
      ],
    };
    const issues = validateModel(cyclic).issues;
    expect(issues.filter((entry) => entry.code === 'destination-cycle')).toHaveLength(2);
  });

  it('rejects duplicate DIDs in the same trunk context', () => {
    const model = buildCompleteModel();
    const broken: PbxModel = {
      ...model,
      inboundRoutes: [
        model.inboundRoutes[0]!,
        {
          ...model.inboundRoutes[0]!,
          id: 'inbound-duplicate',
          name: 'Duplicate',
          destination: { type: 'hangup' },
        },
      ],
    };
    expect(validateModel(broken).issues.some((entry) => entry.code === 'duplicate-did')).toBe(true);
  });

  it('surfaces outbound pattern conflicts as field-level errors', () => {
    const model = buildCompleteModel();
    const broken: PbxModel = {
      ...model,
      outboundRoutes: [
        ...model.outboundRoutes,
        createOutboundRoute({
          id: 'route-conflict',
          name: 'Conflict',
          trunkId: 'trunk-primary',
          patterns: [{ match: '_1[2-8]XXNXXXXXX', strip: 0, prepend: '' }],
        }),
      ],
    };
    const issue = validateModel(broken).issues.find((entry) => entry.code === 'pattern-conflict');
    expect(issue?.path).toMatch(/outboundRoutes\[\d+\]\.patterns\[0\]\.match/);
  });

  it('rejects a future schema version instead of guessing', () => {
    const result = validateModel({ schemaVersion: 99 });
    expect(result.model).toBeNull();
    expect(result.issues[0]?.code).toBe('invalid-model');
    expect(() => assertValidModel({ schemaVersion: 99 })).toThrow(ModelValidationError);
  });

  it('throws a single actionable error listing every problem', () => {
    const broken = createDefaultModel();
    const bad: PbxModel = {
      ...broken,
      extensions: [
        createExtension({ id: 'ext-1', number: '100', secret: '12345678' }),
        createExtension({ id: 'ext-1', number: '100', secret: 'short-secret' }),
      ],
    };
    expect(() => assertValidModel(bad)).toThrow(/weak-secret|duplicate-id|duplicate-number/);
  });
});
