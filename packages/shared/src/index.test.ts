import { describe, expect, it } from 'vitest';

import { CONFIG_SCHEMA_VERSION, schemaVersionSchema } from './index.js';

describe('shared schemas', () => {
  it('pins the configuration schema to version 1', () => {
    expect(CONFIG_SCHEMA_VERSION).toBe(1);
    expect(schemaVersionSchema.parse(1)).toBe(1);
    expect(() => schemaVersionSchema.parse(2)).toThrow();
  });
});
