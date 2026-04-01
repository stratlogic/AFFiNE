/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';

import { extractRollupTagIds } from '../property-presets/rollup/cell-renderer.js';

describe('rollup and multi-select empty rendering helpers', () => {
  it('extractRollupTagIds returns empty array for empty multi-select values', () => {
    expect(
      extractRollupTagIds('multi-select', [null, undefined, [], ['']])
    ).toEqual([]);
  });

  it('extractRollupTagIds dedupes and preserves order for multi-select ids', () => {
    expect(
      extractRollupTagIds('multi-select', [['a', 'b'], ['b', 'c'], [], ['a']])
    ).toEqual(['a', 'b', 'c']);
  });

  it('extractRollupTagIds ignores empty select values', () => {
    expect(
      extractRollupTagIds('select', [null, '', undefined, 'a', 'a'])
    ).toEqual(['a']);
  });
});
