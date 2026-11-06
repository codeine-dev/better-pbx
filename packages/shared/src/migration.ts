import { CONFIG_SCHEMA_VERSION, pbxModelSchema, type PbxModel } from './model.js';

/**
 * A migration takes the raw document from version N to version N + 1. Migrations operate on plain
 * objects so a broken or half-upgraded model can still be read and reported precisely.
 */
export type ModelMigration = (input: Record<string, unknown>) => Record<string, unknown>;

/** Keyed by the version being migrated from. Empty until the first schema change after v1. */
export const modelMigrations: Readonly<Record<number, ModelMigration>> = {};

export class ModelMigrationError extends Error {
  override readonly name = 'ModelMigrationError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read a model from disk, running every needed migration, and validate the result.
 *
 * A model from a future release is rejected rather than guessed at: silently dropping fields would
 * corrupt an operator's configuration on rollback or downgrade.
 */
export function migrateModel(raw: unknown): PbxModel {
  if (!isRecord(raw)) {
    throw new ModelMigrationError('configuration must be a JSON/YAML object');
  }

  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ModelMigrationError('configuration is missing a valid integer schemaVersion');
  }

  if (version > CONFIG_SCHEMA_VERSION) {
    throw new ModelMigrationError(
      `configuration schema version ${version} is newer than this build supports (${CONFIG_SCHEMA_VERSION}); upgrade BetterPBX before editing`,
    );
  }

  let current: Record<string, unknown> = { ...raw };
  for (let from = version; from < CONFIG_SCHEMA_VERSION; from += 1) {
    const migration = modelMigrations[from];
    if (!migration) {
      throw new ModelMigrationError(
        `no migration registered from configuration schema version ${from} to ${from + 1}`,
      );
    }
    current = migration(current);
    current.schemaVersion = from + 1;
  }

  return pbxModelSchema.parse(current);
}
