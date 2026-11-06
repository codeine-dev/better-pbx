import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Test against workspace sources so `pnpm test` does not require a prior build.
    alias: {
      '@better-pbx/shared': fromRoot('./packages/shared/src/index.ts'),
      '@better-pbx/config-engine': fromRoot('./packages/config-engine/src/index.ts'),
      '@better-pbx/test-fixtures': fromRoot('./packages/test-fixtures/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['{apps,packages}/**/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
