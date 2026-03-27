/**
 * Unit tests for LinkedDatabaseBlockDataSource (task 4.9).
 *
 * These tests use lightweight mock objects instead of real BlockSuite / Yjs
 * infrastructure, following the pattern established in data-view's own tests.
 */

/** @vitest-environment happy-dom */

import { signal } from '@preact/signals-core';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { LinkedDatabaseBlockDataSource } from '../data-source.js';

// ---------------------------------------------------------------------------
// Helpers — minimal stubs that satisfy the constructor expectations
// ---------------------------------------------------------------------------

function makeColumn(id: string, type: string, name: string) {
  return { id, type, name, data: {} };
}

function makeMockSourceModel(
  overrides: Partial<ReturnType<typeof baseMockSourceModel>> = {}
) {
  return {
    ...baseMockSourceModel(),
    ...overrides,
  };
}

function baseMockSourceModel() {
  const cells: Record<string, Record<string, { value: unknown }>> = {};
  const columns = [makeColumn('title', 'title', 'Title')];
  const views: any[] = [
    {
      id: 'v1',
      name: 'Table View',
      mode: 'table',
      filter: { conditions: [] },
      sort: { manuallySort: [], sortBy: [] },
      groupBy: undefined,
      header: { titleColumn: '', iconColumn: '' },
      columnOrder: [],
      columns: [],
    },
  ];

  return {
    id: 'source-db-id',
    flavour: 'affine:database',
    children: [{ id: 'row-1' }, { id: 'row-2' }],
    childMap: {
      value: new Map([
        ['row-1', 0],
        ['row-2', 1],
      ]),
    },
    props: {
      title: { toString: () => 'Source DB' },
      columns: columns,
      columns$: signal(columns),
      views: views,
      views$: signal(views),
      cells$: signal(cells),
    },
    store: {
      readonly: false,
      provider: { get: () => null, getOptional: () => null },
      get: () => null,
      transact: (fn: () => void) => fn(),
      getBlock: (id: string) => ({ id, model: { children: [] } }),
      getBlocksByFlavour: () => [],
      workspace: { idGenerator: () => Math.random().toString(36).slice(2) },
    },
    text: null,
  } as any;
}

function makeMockLinkedModel(sourceId: string) {
  const views: any[] = [];
  const store = {
    transact: (fn: () => void) => fn(),
    readonly: false,
    provider: { get: () => null, getOptional: () => null },
  };
  return {
    id: 'linked-db-id',
    props: {
      sourceDatabaseId: sourceId,
      views: views,
      views$: signal(views),
    },
    store,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinkedDatabaseBlockDataSource', () => {
  let sourceModel: ReturnType<typeof makeMockSourceModel>;
  let linkedModel: ReturnType<typeof makeMockLinkedModel>;
  let ds: LinkedDatabaseBlockDataSource;

  beforeEach(() => {
    sourceModel = makeMockSourceModel();
    linkedModel = makeMockLinkedModel(sourceModel.id);
    ds = new LinkedDatabaseBlockDataSource(linkedModel, sourceModel);
  });

  describe('initial state', () => {
    test('creates a default view when linked model has no views', () => {
      // The constructor should push at least one view entry.
      expect(linkedModel.props.views.length).toBeGreaterThanOrEqual(1);
      expect(linkedModel.props.views[0].mode).toBe('table');
    });
  });

  describe('delegation — rows and cells', () => {
    test('rows$ reflects source database children', () => {
      // rows$ is delegated to the source data source.
      const rows = ds.rows$.value;
      expect(rows).toContain('row-1');
      expect(rows).toContain('row-2');
    });

    test('cellValueGet delegates to source database', () => {
      // Spy on the source data source's cellValueGet via the private field.
      const sourceDsMock = (ds as any)._source;
      const spy = vi
        .spyOn(sourceDsMock, 'cellValueGet')
        .mockReturnValue('mocked-value');

      const result = ds.cellValueGet('row-1', 'title');

      expect(spy).toHaveBeenCalledWith('row-1', 'title');
      expect(result).toBe('mocked-value');
    });

    test('cellValueChange delegates to source database', () => {
      const sourceDsMock = (ds as any)._source;
      const spy = vi
        .spyOn(sourceDsMock, 'cellValueChange')
        .mockImplementation(() => {});

      ds.cellValueChange('row-1', 'title', 'new-value');

      expect(spy).toHaveBeenCalledWith('row-1', 'title', 'new-value');
    });
  });

  describe('view independence', () => {
    test('viewDataAdd writes to linked model, not source', () => {
      const initialSourceViews = sourceModel.props.views.length;

      const newView: any = {
        id: 'new-view',
        name: 'Kanban',
        mode: 'kanban',
        filter: { conditions: [] },
        sort: { manuallySort: [], sortBy: [] },
        groupBy: undefined,
        header: { titleColumn: '', iconColumn: '' },
        columnOrder: [],
        columns: [],
      };
      ds.viewDataAdd(newView);

      // Source views must be unchanged.
      expect(sourceModel.props.views.length).toBe(initialSourceViews);
      // Linked model must have the new view.
      expect(
        linkedModel.props.views.some((v: any) => v.id === 'new-view')
      ).toBe(true);
    });

    test('viewDataDelete removes from linked model, not source', () => {
      const viewId = linkedModel.props.views[0]?.id as string;
      // Add a second view so delete doesn't leave zero views.
      linkedModel.props.views.push({
        id: 'extra-view',
        name: 'Extra',
        mode: 'table',
        filter: { conditions: [] },
        sort: { manuallySort: [], sortBy: [] },
        groupBy: undefined,
        header: { titleColumn: '', iconColumn: '' },
        columnOrder: [],
        columns: [],
      });

      const sourceViewCountBefore = sourceModel.props.views.length;
      ds.viewDataDelete(viewId);

      expect(linkedModel.props.views.some((v: any) => v.id === viewId)).toBe(
        false
      );
      expect(sourceModel.props.views.length).toBe(sourceViewCountBefore);
    });
  });

  describe('C.2 backward compat — unknown view types', () => {
    test('viewMetaGetById returns undefined for unrecognised view mode', () => {
      // Simulate a future view type written by a newer client.
      linkedModel.props.views.push({
        id: 'future-view',
        name: 'Future',
        mode: 'future-view', // not registered in databaseBlockViews
        filter: { conditions: [] },
        sort: { manuallySort: [], sortBy: [] },
        groupBy: undefined,
        header: { titleColumn: '', iconColumn: '' },
        columnOrder: [],
        columns: [],
      });

      const result = ds.viewMetaGetById('future-view');
      // Must not throw — must return undefined so the view manager skips it.
      expect(result).toBeUndefined();
    });

    test('viewMetaGet falls back to default view instead of throwing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = ds.viewMetaGet('future-view');

      // Must not throw.
      expect(result).toBeDefined();
      // A warning must have been emitted.
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
