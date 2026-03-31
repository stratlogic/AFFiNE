/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';

import {
  filterRelationIdsByValidSet,
  getRowLinkedPageTarget,
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

  it('getRowTitle resolves linked-page alias title', () => {
    const store = {
      workspace: { meta: { docMetas: [] } },
      getBlock: (id: string) => {
        if (id !== 'row1') return null;
        return {
          model: {
            title: {
              toString: () => '',
              deltas$: {
                value: [
                  {
                    insert: ' ',
                    attributes: {
                      reference: {
                        type: 'LinkedPage',
                        pageId: 'doc-1',
                        title: 'Roadmap',
                      },
                    },
                  },
                ],
              },
            },
          },
        };
      },
    } as any;

    expect(getRowTitle(store, 'row1')).toBe('Roadmap');
  });

  it('getRowTitle resolves linked-page title from doc meta', () => {
    const store = {
      workspace: {
        meta: {
          docMetas: [{ id: 'doc-1', title: 'Doc From Meta' }],
        },
      },
      getBlock: (id: string) => {
        if (id !== 'row1') return null;
        return {
          model: {
            title: {
              toString: () => '',
              deltas$: {
                value: [
                  {
                    insert: ' ',
                    attributes: {
                      reference: {
                        type: 'LinkedPage',
                        pageId: 'doc-1',
                      },
                    },
                  },
                ],
              },
            },
          },
        };
      },
    } as any;

    expect(getRowTitle(store, 'row1')).toBe('Doc From Meta');
  });

  it('getRowLinkedPageTarget returns linked page id from title', () => {
    const store = {
      getBlock: (id: string) => {
        if (id !== 'row1') return null;
        return {
          model: {
            title: {
              deltas$: {
                value: [
                  {
                    insert: ' ',
                    attributes: {
                      reference: {
                        type: 'LinkedPage',
                        pageId: 'doc-xyz',
                      },
                    },
                  },
                ],
              },
            },
          },
        };
      },
    } as any;

    expect(getRowLinkedPageTarget(store, 'row1')).toBe('doc-xyz');
  });

  it('filterRelationIdsByValidSet filters ids by membership', () => {
    const validIds = new Set(['b', 'c']);
    expect(filterRelationIdsByValidSet(['a', 'b', 'c'], validIds)).toEqual([
      'b',
      'c',
    ]);
  });
});
