/** @vitest-environment happy-dom */

import { describe, expect, test, vi } from 'vitest';

import {
  getRelationIdsFromContainer,
  setRelationIdsOnContainer,
  updateColumnRelationData,
} from '../utils/relation-container-cells.js';

describe('relation-container-cells — affine:data-view', () => {
  test('getRelationIdsFromContainer reads raw string[] from data-view cells', () => {
    const container = {
      flavour: 'affine:data-view',
      props: {
        cells: {
          row1: { colA: ['a', 'b'] },
        },
      },
    };
    expect(
      getRelationIdsFromContainer(container as never, 'row1', 'colA')
    ).toEqual(['a', 'b']);
  });

  test('setRelationIdsOnContainer writes raw string[] via transact', () => {
    const transact = vi.fn((fn: () => void) => fn());
    const cells: Record<string, Record<string, unknown>> = {};
    const container = {
      flavour: 'affine:data-view',
      store: { transact },
      props: { cells },
    };
    setRelationIdsOnContainer(container as never, 'r', 'c', ['x']);
    expect(cells.r).toEqual({ c: ['x'] });
    expect(transact).toHaveBeenCalled();
  });

  test('updateColumnRelationData updates data-view column definition', () => {
    const transact = vi.fn((fn: () => void) => fn());
    const columns = [{ id: 'c1', type: 'relation', name: 'R', data: { a: 1 } }];
    const container = {
      flavour: 'affine:data-view',
      store: { transact },
      props: { columns },
    };
    updateColumnRelationData(container as never, 'c1', d => ({
      ...d,
      reversePropertyId: null,
    }));
    expect(columns[0]!.data).toEqual({ a: 1, reversePropertyId: null });
  });
});
