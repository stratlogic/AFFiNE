import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  test: {
    globalSetup: '../../../scripts/vitest-global.js',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 1000,
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov'],
      reportsDirectory: '../../../../.coverage/affine-block-linked-database',
    },
    environment: 'happy-dom',
  },
});
