/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';

import {
  filterRelationIdsByValidSet,
  getRowTitle,
} from '../property-presets/relation/cell-renderer.js';

describe('relation cell renderer edge cases', () => {
  it('getRowTitle returns (deleted) when row is missing', () => {
    const store = {
      getBlock: () => null,
    } as any;

    expect(getRowTitle(store, 'missing-row')).toBe('(deleted)');
  });

  it('getRowTitle shows Untitled when title text is empty', () => {
    let accessed = false;
    const titleText = {
      toString: () => '',
      deltas$: {
        get value() {
          accessed = true;
          return [];
        },
      },
    };

    const store = {
      getBlock: (id: string) =>
        id === 'row1' ? { model: { title: titleText } } : null,
    } as any;

    expect(getRowTitle(store, 'row1')).toBe('Untitled');
    expect(accessed).toBe(true);
  });

  it('getRowTitle keeps whitespace-only titles as-is', () => {
    let accessed = false;
    const titleText = {
      toString: () => '   ',
      deltas$: {
        get value() {
          accessed = true;
          return [];
        },
      },
    };

    const store = {
      getBlock: (id: string) =>
        id === 'row1' ? { model: { title: titleText } } : null,
    } as any;

    expect(getRowTitle(store, 'row1')).toBe('   ');
    expect(accessed).toBe(true);
  });

  it('getRowTitle falls back to text when title resolves to empty', () => {
    const store = {
      getBlock: (id: string) => {
        if (id !== 'row1') return null;
        return {
          model: {
            title: { toString: () => '', deltas$: { value: [] } },
            text: { toString: () => 'Hello', deltas$: { value: [] } },
          },
        };
      },
    } as any;

    expect(getRowTitle(store, 'row1')).toBe('Hello');
  });

  it('filterRelationIdsByValidSet filters ids by membership', () => {
    const validIds = new Set(['b', 'c']);
    expect(filterRelationIdsByValidSet(['a', 'b', 'c'], validIds)).toEqual([
      'b',
      'c',
    ]);
  });
});
