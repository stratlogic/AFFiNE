/** @vitest-environment happy-dom */

import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
  TableBlockSchemaExtension,
} from '@blocksuite/affine-model';
import { nanoid, type Store, Text } from '@blocksuite/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@blocksuite/store/test';
import { beforeEach, describe, expect, test } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';
import { migrateTableBlockToDatabase } from '../migration/table-to-database.js';

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  TableBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

function createStore() {
  const idGenerator = createAutoIncrementIdGenerator();
  const collection = new TestWorkspace({ id: 'coll-table-mig', idGenerator });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  return doc.getStore({ extensions });
}

function addSimpleTable(store: Store, noteId: string) {
  const row1 = nanoid();
  const row2 = nanoid();
  const col1 = nanoid();
  const col2 = nanoid();

  const tableId = store.addBlock(
    'affine:table',
    {
      rows: {
        [row1]: { rowId: row1, order: 'a0' },
        [row2]: { rowId: row2, order: 'a1' },
      },
      columns: {
        [col1]: { columnId: col1, order: 'a0' },
        [col2]: { columnId: col2, order: 'a1' },
      },
      cells: {
        [`${row1}:${col1}`]: { text: new Text('Title1') },
        [`${row1}:${col2}`]: { text: new Text('R1C2') },
        [`${row2}:${col1}`]: { text: new Text('Title2') },
        [`${row2}:${col2}`]: { text: new Text('R2C2') },
      },
    },
    noteId
  );

  return { tableId };
}

describe('migrateTableBlockToDatabase', () => {
  let store: Store;
  let noteId: string;

  beforeEach(() => {
    store = createStore();
    const root = store.addBlock('affine:page', {
      title: new Text('t'),
    });
    noteId = store.addBlock('affine:note', {}, root);
  });

  test('returns null for non-table', () => {
    const p = store.addBlock('affine:paragraph', {}, noteId);
    expect(migrateTableBlockToDatabase(store, p)).toBeNull();
  });

  test('converts table to database with text preserved', () => {
    const { tableId } = addSimpleTable(store, noteId);

    const dbId = migrateTableBlockToDatabase(store, tableId);
    expect(dbId).toBeTruthy();

    expect(store.getBlock(tableId)).toBeUndefined();

    const db = store.getBlock(dbId!)?.model as DatabaseBlockModel;
    expect(db.flavour).toBe('affine:database');

    const ds = new DatabaseBlockDataSource(db);
    const rows = ds.rows$.value;
    expect(rows.length).toBe(2);

    const t1 = store.getBlock(rows[0]!)?.model;
    const t2 = store.getBlock(rows[1]!)?.model;
    expect(t1?.text?.toString()).toBe('Title1');
    expect(t2?.text?.toString()).toBe('Title2');

    const cols = db.props.columns.filter(c => c.type === 'rich-text');
    expect(cols.length).toBe(1);

    const rid0 = rows[0]!;
    const rid1 = rows[1]!;
    const richId = cols[0]!.id;
    expect(ds.cellValueGet(rid0, richId)?.toString?.()).toBe('R1C2');
    expect(ds.cellValueGet(rid1, richId)?.toString?.()).toBe('R2C2');
  });
});
