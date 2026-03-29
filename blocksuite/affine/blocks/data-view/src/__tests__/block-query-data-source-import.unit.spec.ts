/** @vitest-environment happy-dom */

/**
 * Ensures BlockQueryDataSource can be loaded under Vitest when vanilla-extract
 * is handled (see vitest.config.ts). Without @vanilla-extract/vite-plugin,
 * importing data-source pulls view-presets and fails on *.css.ts.
 */

import { describe, expect, test } from 'vitest';

import { BlockQueryDataSource } from '../data-source.js';

describe('BlockQueryDataSource module', () => {
  test('imports and exposes class', () => {
    expect(BlockQueryDataSource).toBeDefined();
    expect(BlockQueryDataSource.prototype).toBeDefined();
    expect(BlockQueryDataSource.prototype.cellValueChange).toBeTypeOf(
      'function'
    );
  });
});
