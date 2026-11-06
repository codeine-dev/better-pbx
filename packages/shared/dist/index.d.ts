import { z } from 'zod';
/**
 * The on-disk configuration schema version. The API and the UI share this value so a model written
 * by one can always be validated by the other.
 */
export declare const CONFIG_SCHEMA_VERSION = 1;
export declare const schemaVersionSchema: z.ZodLiteral<1>;
export type SchemaVersion = z.infer<typeof schemaVersionSchema>;
//# sourceMappingURL=index.d.ts.map