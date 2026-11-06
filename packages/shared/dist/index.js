import { z } from 'zod';
/**
 * The on-disk configuration schema version. The API and the UI share this value so a model written
 * by one can always be validated by the other.
 */
export const CONFIG_SCHEMA_VERSION = 1;
export const schemaVersionSchema = z.literal(CONFIG_SCHEMA_VERSION);
//# sourceMappingURL=index.js.map