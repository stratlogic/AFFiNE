/**
 * Unit tests for DatabaseBlockDataSource (tasks 1.9, 2.9, 3.10).
 */

/** @vitest-environment happy-dom */

import type { RollupPropertyData } from '@blocksuite/data-view/property-presets';
import { signal } from '@preact/signals-core';
import { beforeEach, describe, expect, test } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';

// ---------------------------------------------------------------------------
// Helpers — minimal stubs for DatabaseBlockModel
// ---------------------------------------------------------------------------

function makeMockDatabaseModel(id: string, title: string) {
  const columns: any[] = [];
  const cells: Record<string, any> = {};
  const children: any[] = [];
  const childMap = new Map<string, number>();

  const store = {
    readonly: false,
    provider: { get: () => ({ getFlag: () => true }) },
    get: (key: any) =>
      key === 'FeatureFlagService' ? { getFlag: () => true } : null,
    transact: (fn: () => void) => fn(),
    captureSync: () => {},
    getBlock: (_id: string) => null, // Will be overridden in tests
    workspace: { idGenerator: () => Math.random().toString(36).slice(2) },
  };

  const model = {
    id,
    flavour: 'affine:database',
    children,
    childMap: { value: childMap },
    props: {
      title: { toString: () => title },
      columns,
      columns$: signal(columns),
      cells,
      cells$: signal(cells),
      views: [],
      views$: signal([]),
    },
    store,
  } as any;

  return model;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DatabaseBlockDataSource — Relations & Rollups', () => {
  let dbA: any;
  let dbB: any;
  let dsA: DatabaseBlockDataSource;
  let dsB: DatabaseBlockDataSource;

  beforeEach(() => {
    dbA = makeMockDatabaseModel('db-a', 'Database A');
    dbB = makeMockDatabaseModel('db-b', 'Database B');

    // Setup cross-reference for getBlock
    dbA.store.getBlock = (id: string) => {
      if (id === 'db-a') return { model: dbA };
      if (id === 'db-b') return { model: dbB };
      return null;
    };
    dbB.store.getBlock = dbA.store.getBlock;

    dsA = new DatabaseBlockDataSource(dbA);
    dsB = new DatabaseBlockDataSource(dbB);
  });

  describe('Bidirectional Relations (Phase 2)', () => {
    test('propertyDataSet creates reverse column in target database', () => {
      const relationId = 'rel-1';
      dbA.props.columns.push({
        id: relationId,
        type: 'relation',
        name: 'To B',
        data: {},
      });

      dsA.propertyDataSet(relationId, {
        targetDatabaseId: 'db-b',
        isBidirectional: true,
      });

      // DB-A should have updated data with reversePropertyId
      const dataA = dsA.propertyDataGet(relationId) as any;
      expect(dataA.reversePropertyId).toBeDefined();

      // DB-B should now have a relation column pointing back to DB-A
      const reverseCol = dbB.props.columns.find(
        (c: any) => c.id === dataA.reversePropertyId
      );
      expect(reverseCol).toBeDefined();
      expect(reverseCol.type).toBe('relation');
      expect(reverseCol.data.targetDatabaseId).toBe('db-a');
      expect(reverseCol.data.isReverse).toBe(true);
    });

    test('cellValueChange syncs added row to reverse database', () => {
      // Setup bidirectional relation
      const relA = 'rel-a';
      const relB = 'rel-b';
      dbA.props.columns.push({
        id: relA,
        type: 'relation',
        name: 'To B',
        data: {
          targetDatabaseId: 'db-b',
          isBidirectional: true,
          reversePropertyId: relB,
        },
      });
      dbB.props.columns.push({
        id: relB,
        type: 'relation',
        name: 'To A',
        data: {
          targetDatabaseId: 'db-a',
          isBidirectional: true,
          isReverse: true,
          reversePropertyId: relA,
        },
      });

      // Add rows
      dbA.children.push({ id: 'row-a1' });
      dbA.childMap.value.set('row-a1', 0);
      dbB.children.push({ id: 'row-b1' });
      dbB.childMap.value.set('row-b1', 0);

      // Link row-a1 to row-b1
      dsA.cellValueChange('row-a1', relA, ['row-b1']);

      // Check DB-A cell
      expect(dsA.cellValueGet('row-a1', relA)).toEqual(['row-b1']);

      // Check DB-B cell (reverse sync)
      expect(dsB.cellValueGet('row-b1', relB)).toEqual(['row-a1']);
    });
  });

  describe('Rollup Computations (Phase 3)', () => {
    test('computes SUM rollup correctly', () => {
      // Setup relation
      const relId = 'rel-1';
      dbA.props.columns.push({
        id: relId,
        type: 'relation',
        name: 'Related',
        data: { targetDatabaseId: 'db-b' },
      });

      // Setup target column in DB-B
      const targetColId = 'num-1';
      dbB.props.columns.push({
        id: targetColId,
        type: 'number',
        name: 'Value',
        data: {},
      });

      // Setup rollup in DB-A
      const rollupId = 'roll-1';
      dbA.props.columns.push({
        id: rollupId,
        type: 'rollup',
        name: 'Sum',
        data: {
          relationPropertyId: relId,
          targetPropertyId: targetColId,
          calculation: 'sum',
        } as RollupPropertyData,
      });

      // Add rows and link
      dbA.children.push({ id: 'row-a1' });
      dbA.childMap.value.set('row-a1', 0);
      dbB.children.push({ id: 'row-b1' }, { id: 'row-b2' });
      dbB.childMap.value.set('row-b1', 0);
      dbB.childMap.value.set('row-b2', 1);

      // dbB values
      dbB.props.cells['row-b1'] = { [targetColId]: { value: 10 } };
      dbB.props.cells['row-b2'] = { [targetColId]: { value: 20 } };

      // Link row-a1 to both rows in B
      dbA.props.cells['row-a1'] = { [relId]: { value: ['row-b1', 'row-b2'] } };

      // Compute rollup
      const result = dsA.cellValueGet('row-a1', rollupId);
      expect(result).toBe(30);
    });

    test('computes AVERAGE and COUNT rollups', () => {
      const relId = 'rel-1';
      dbA.props.columns.push({
        id: relId,
        type: 'relation',
        name: 'Related',
        data: { targetDatabaseId: 'db-b' },
      });

      const targetColId = 'num-1';
      dbB.props.columns.push({
        id: targetColId,
        type: 'number',
        name: 'Value',
        data: {},
      });

      const rollupAvgId = 'roll-avg';
      dbA.props.columns.push({
        id: rollupAvgId,
        type: 'rollup',
        name: 'Average',
        data: {
          relationPropertyId: relId,
          targetPropertyId: targetColId,
          calculation: 'average',
        },
      });

      const rollupCountId = 'roll-count';
      dbA.props.columns.push({
        id: rollupCountId,
        type: 'rollup',
        name: 'Count',
        data: {
          relationPropertyId: relId,
          targetPropertyId: targetColId,
          calculation: 'count_all',
        },
      });

      // Add rows
      dbA.children.push({ id: 'row-a1' });
      dbA.childMap.value.set('row-a1', 0);
      dbB.children.push({ id: 'row-b1' }, { id: 'row-b2' }, { id: 'row-b3' });
      dbB.childMap.value.set('row-b1', 0);
      dbB.childMap.value.set('row-b2', 1);
      dbB.childMap.value.set('row-b3', 2);

      // dbB values
      dbB.props.cells['row-b1'] = { [targetColId]: { value: 10 } };
      dbB.props.cells['row-b2'] = { [targetColId]: { value: 20 } };
      dbB.props.cells['row-b3'] = { [targetColId]: { value: 30 } };

      // Link row-a1 to all 3 rows in B
      dbA.props.cells['row-a1'] = {
        [relId]: { value: ['row-b1', 'row-b2', 'row-b3'] },
      };

      // Assert Average
      expect(dsA.cellValueGet('row-a1', rollupAvgId)).toBe(20);
      // Assert Count
      expect(dsA.cellValueGet('row-a1', rollupCountId)).toBe(3);
    });
  });
});
