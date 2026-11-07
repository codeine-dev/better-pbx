import { migrateModel, type PbxModel } from '@better-pbx/shared';

import { checkSecurityPolicy, type SecurityPolicyOptions } from '../policy/security.js';
import { validateCrossResource, type ValidationIssue } from './cross-resource.js';

export interface ModelValidationResult {
  model: PbxModel | null;
  issues: ValidationIssue[];
}

export class ModelValidationError extends Error {
  override readonly name = 'ModelValidationError';

  constructor(readonly issues: ValidationIssue[]) {
    super(
      `model validation failed:\n${issues
        .map((entry) => `  - [${entry.code}] ${entry.path}: ${entry.message}`)
        .join('\n')}`,
    );
  }
}

/**
 * Validate a raw document end to end: migrate/parse with the shared Zod model, enforce the security
 * policy, then resolve every cross-resource reference and cycle.
 *
 * Returning issues rather than throwing immediately lets the API present all field-level problems
 * in one response and lets tests assert on exact paths.
 */
export function validateModel(
  raw: unknown,
  options: SecurityPolicyOptions = {},
): ModelValidationResult {
  let model: PbxModel;
  try {
    model = migrateModel(raw);
  } catch (error) {
    return {
      model: null,
      issues: [
        {
          code: 'invalid-model',
          path: '',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error',
        },
      ],
    };
  }

  const issues: ValidationIssue[] = checkSecurityPolicy(model, options).map((entry) => ({
    code: entry.code,
    path: entry.path,
    message: entry.message,
    severity: entry.severity,
  }));
  issues.push(...validateCrossResource(model));

  return { model, issues };
}

/** Validate or throw. This is the only way to obtain a model that may be rendered and applied. */
export function assertValidModel(raw: unknown, options: SecurityPolicyOptions = {}): PbxModel {
  const result = validateModel(raw, options);
  if (result.issues.length > 0 || result.model === null) {
    throw new ModelValidationError(result.issues);
  }
  return result.model;
}
