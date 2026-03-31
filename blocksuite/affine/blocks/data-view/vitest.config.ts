import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2018',
  },
  plugins: [vanillaExtractPlugin()],
  test: {
    globalSetup: '../../../scripts/vitest-global.js',
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 10000,
    environment: 'happy-dom',
  },
});
