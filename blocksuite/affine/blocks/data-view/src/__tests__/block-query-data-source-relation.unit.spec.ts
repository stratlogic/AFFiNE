/** @vitest-environment happy-dom */

/**
 * Integration-style tests for BlockQueryDataSource relation sync (Phase E follow-up).
 * Requires Vitest + vanilla-extract (see vitest.config.ts).
 */

import { getCell } from '@blocksuite/affine-block-database';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@blocksuite/affine-model';
import { FeatureFlagService } from '@blocksuite/affine-shared/services';
import type { EditorHost } from '@blocksuite/std';
import { type Store, Text } from '@blocksuite/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@blocksuite/store/test';
import { beforeEach, describe, expect, test } from 'vitest';

import { BlockQueryDataSource } from '../data-source.js';
import {
  type DataViewBlockModel,
  DataViewBlockSchemaExtension,
} from '../data-view-model.js';

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  ListBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
  DataViewBlockSchemaExtension,
  FeatureFlagService,
];

function createStore(): Store {
  const idGenerator = createAutoIncrementIdGenerator();
  const collection = new TestWorkspace({ id: 'coll-bqds-rel', idGenerator });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  return doc.getStore({ extensions });
}

function asHost(store: Store): EditorHost {
  return { store } as unknown as EditorHost;
}

describe('BlockQueryDataSource — relation sync to database', () => {
  let store: Store;
  let dbId: string;
  let dbRowId: string;
  let todoRowId: string;
  let dataViewId: string;
  let dvModel: DataViewBlockModel;
  let dbModel: DatabaseBlockModel;

  beforeEach(() => {
    store = createStore();
    const rootId = store.addBlock('affine:page', { title: new Text('page') });
    const noteId = store.addBlock('affine:note', {}, rootId);

    todoRowId = store.addBlock(
      'affine:list',
      {
        type: 'todo',
        text: new Text('Todo A'),
        checked: false,
        collapsed: false,
        order: null,
      },
      noteId
    );

    store.addBlock(
      'affine:list',
      {
        type: 'todo',
        text: new Text('Todo B'),
        checked: false,
        collapsed: false,
        order: null,
      },
      noteId
    );

    dbId = store.addBlock(
      'affine:database',
      { title: new Text('Target DB'), views: [], columns: [] },
      noteId
    );
    dbRowId = store.addBlock('affine:paragraph', {}, dbId);
    dbModel = store.getBlock(dbId)!.model as DatabaseBlockModel;

    dataViewId = store.addBlock(
      'affine:data-view',
      {
        title: 'Query',
        views: [
          {
            id: 'v1',
            name: 'Table',
            mode: 'table',
            data: {
              mode: 'table',
              columns: [],
              filter: { type: 'group', op: 'and', conditions: [] },
            },
          },
        ],
        columns: [],
        cells: {},
      },
      noteId
    );
    dvModel = store.getBlock(dataViewId)!.model as DataViewBlockModel;
  });

  test('bidirectional relation writes reverse cell on database row', () => {
    const ds = new BlockQueryDataSource(asHost(store), dvModel, {
      type: 'todo',
    });

    expect(ds.rows$.value).toContain(todoRowId);

    const relId = ds.propertyAdd('end', { type: 'relation', name: 'Link' });
    ds.propertyDataSet(relId, {
      targetDatabaseId: dbId,
      isBidirectional: true,
    });

    const relData = ds.propertyDataGet(relId) as Record<string, unknown>;
    const reverseId = relData.reversePropertyId as string;
    expect(reverseId).toBeTruthy();

    ds.cellValueChange(todoRowId, relId, [dbRowId]);

    const revCell = getCell(dbModel, dbRowId, reverseId);
    const v = revCell?.value as unknown;
    expect(Array.isArray(v) ? v : []).toContain(todoRowId);
  });

  test('rollup show_original resolves select option labels', () => {
    const ds = new BlockQueryDataSource(asHost(store), dvModel, {
      type: 'todo',
    });

    const statusColId = store.workspace.idGenerator();
    dbModel.props.columns.push({
      id: statusColId,
      type: 'select',
      name: 'Status',
      data: {
        options: [
          { id: 'option_todo', value: 'To Do', color: 'gray' },
          { id: 'option_done', value: 'Done', color: 'green' },
        ],
      },
    } as any);

    const dbRowId2 = store.addBlock('affine:paragraph', {}, dbId);
    store.transact(() => {
      dbModel.props.cells[dbRowId] = {
        ...dbModel.props.cells[dbRowId],
        [statusColId]: { value: 'option_todo' },
      };
      dbModel.props.cells[dbRowId2] = {
        ...dbModel.props.cells[dbRowId2],
        [statusColId]: { value: 'option_done' },
      };
    });

    const relId = ds.propertyAdd('end', { type: 'relation', name: 'Link' });
    ds.propertyDataSet(relId, {
      targetDatabaseId: dbId,
      isBidirectional: false,
    });

    const rollupId = ds.propertyAdd('end', {
      type: 'rollup',
      name: 'Statuses',
    });
    ds.propertyDataSet(rollupId, {
      relationPropertyId: relId,
      targetPropertyId: statusColId,
      calculation: 'show_original',
    });

    ds.cellValueChange(todoRowId, relId, [dbRowId, dbRowId2]);

    expect(ds.cellValueGet(todoRowId, rollupId)).toEqual(['To Do', 'Done']);
  });
});
