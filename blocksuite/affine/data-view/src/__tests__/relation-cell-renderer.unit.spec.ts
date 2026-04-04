/** @vitest-environment happy-dom */

import { FeatureFlagService } from '@blocksuite/affine-shared/services';
import type { Store } from '@blocksuite/store';
import { describe, expect, it } from 'vitest';

import {
  filterRelationIdsByValidSet,
  getRowLinkedPageTarget,
  getRowTitle,
  isCrossDocRelationStore,
  isCrossTeamspaceRelationFlagOn,
  isCrossWorkspaceRelayColumnUx,
  viewOnlyCrossDocRelationChipLabel,
} from '../property-presets/relation/cell-renderer.js';

function storeWithCrossWorkspaceFlag(enabled: boolean): Store {
  return {
    id: 'doc-a',
    get(svc: unknown) {
      if (svc === FeatureFlagService) {
        return {
          getFlag(key: string) {
            if (key === 'enable_cross_workspace_relation') return enabled;
            return false;
          },
        };
      }
      throw new Error('unexpected store.get');
    },
  } as unknown as Store;
}

function storeWithTeamspaceFlag(enabled: boolean): Store {
  return {
    id: 'doc-a',
    get(svc: unknown) {
      if (svc === FeatureFlagService) {
        return {
          getFlag(key: string) {
            if (key === 'enable_cross_teamspace_relation') return enabled;
            return false;
          },
        };
      }
      throw new Error('unexpected store.get');
    },
  } as unknown as Store;
}

describe('relation cell renderer edge cases', () => {
  it('isCrossTeamspaceRelationFlagOn reads feature flag', () => {
    expect(isCrossTeamspaceRelationFlagOn(storeWithTeamspaceFlag(false))).toBe(
      false
    );
    expect(isCrossTeamspaceRelationFlagOn(storeWithTeamspaceFlag(true))).toBe(
      true
    );
  });

  it('isCrossDocRelationStore requires target doc different from store', () => {
    const s = storeWithTeamspaceFlag(true);
    expect(isCrossDocRelationStore(s, {})).toBe(false);
    expect(isCrossDocRelationStore(s, { targetDocId: 'doc-a' })).toBe(false);
    expect(isCrossDocRelationStore(s, { targetDocId: 'doc-b' })).toBe(true);
  });

  it('isCrossWorkspaceRelayColumnUx requires flag and metadata', () => {
    const storeOff = storeWithCrossWorkspaceFlag(false);
    expect(
      isCrossWorkspaceRelayColumnUx(storeOff, {
        crossWorkspaceRelayReadOnly: true,
      })
    ).toBe(false);

    const storeOn = storeWithCrossWorkspaceFlag(true);
    expect(
      isCrossWorkspaceRelayColumnUx(storeOn, {
        crossWorkspaceRelayReadOnly: true,
      })
    ).toBe(true);
    expect(
      isCrossWorkspaceRelayColumnUx(storeOn, {
        crossWorkspaceTargetWorkspaceId: 'ws-1',
      })
    ).toBe(true);
    expect(isCrossWorkspaceRelayColumnUx(storeOn, {})).toBe(false);
  });

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

  it('viewOnlyCrossDocRelationChipLabel uses short id verbatim', () => {
    expect(viewOnlyCrossDocRelationChipLabel('shortid')).toBe('shortid');
  });

  it('viewOnlyCrossDocRelationChipLabel abbreviates long ids', () => {
    expect(viewOnlyCrossDocRelationChipLabel('verylongrowidentifier')).toMatch(
      /^Linked record \(verylong…\)$/
    );
  });
});
