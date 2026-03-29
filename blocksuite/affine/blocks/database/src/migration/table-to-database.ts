import type {
  DatabaseBlockModel,
  TableBlockModel,
} from '@blocksuite/affine-model';
import { viewPresets } from '@blocksuite/data-view/view-presets';
import type { Store, Text } from '@blocksuite/store';

import { DatabaseBlockDataSource } from '../data-source.js';
import { updateCell } from '../utils/block-utils.js';

function sortedTableRows(model: TableBlockModel) {
  return Object.values(model.props.rows).sort((a, b) =>
    a.order > b.order ? 1 : -1
  );
}

function sortedTableColumns(model: TableBlockModel) {
  return Object.values(model.props.columns).sort((a, b) =>
    a.order > b.order ? 1 : -1
  );
}

/**
 * Converts an `affine:table` block into an `affine:database` at the same
 * parent index, then deletes the table. Must run inside `store.transact` if
 * batched with other updates; this function calls `captureSync` once.
 *
 * @returns New database block id, or null if the source is not a table.
 */
export function migrateTableBlockToDatabase(
  store: Store,
  tableBlockId: string
): string | null {
  const block = store.getBlock(tableBlockId);
  const tableModel = block?.model;
  if (!tableModel || tableModel.flavour !== 'affine:table') {
    return null;
  }

  const parent = store.getParent(tableModel);
  if (!parent) {
    return null;
  }

  const index = parent.children.indexOf(tableModel);
  const typedTable = tableModel as TableBlockModel;

  store.captureSync();

  const dbId = store.addBlock('affine:database', {}, parent, index);
  const dbModel = store.getBlock(dbId)?.model as DatabaseBlockModel | undefined;
  if (!dbModel) {
    return null;
  }

  const ds = new DatabaseBlockDataSource(dbModel);
  ds.viewManager.viewAdd(viewPresets.tableViewMeta.type);

  const columns = sortedTableColumns(typedTable);
  const rows = sortedTableRows(typedTable);

  const richTextColumnIds: string[] = [];
  for (let c = 1; c < columns.length; c++) {
    const id = ds.propertyAdd('end', {
      type: 'rich-text',
      name: `Column ${c + 1}`,
    });
    if (id) {
      richTextColumnIds.push(id);
    }
  }

  for (const row of rows) {
    const rowId = ds.rowAdd('end');
    const firstCol = columns[0];
    if (firstCol) {
      const cell = typedTable.props.cells[`${row.rowId}:${firstCol.columnId}`];
      const para = store.getBlock(rowId)?.model;
      if (cell?.text && para && 'text' in para) {
        (para as { text: Text }).text = cell.text.clone();
      }
    }

    for (let c = 1; c < columns.length; c++) {
      const colMeta = columns[c];
      const propId = richTextColumnIds[c - 1];
      if (!colMeta || !propId) continue;
      const cell = typedTable.props.cells[`${row.rowId}:${colMeta.columnId}`];
      if (cell?.text) {
        updateCell(dbModel, rowId, {
          columnId: propId,
          value: cell.text.clone(),
        });
      }
    }
  }

  const viewId = ds.viewManager.currentViewId$.value;
  if (viewId) {
    ds.viewDataUpdate(viewId, old => {
      const tableData = old as {
        columns?: { id: string; width: number }[];
        header?: { titleColumn?: string; iconColumn?: string };
      };
      const tableColumns: { id: string; width: number }[] = [
        { id: 'title', width: 200 },
        ...richTextColumnIds.map(id => ({ id, width: 200 })),
      ];
      return {
        ...old,
        columns: tableColumns,
        header: {
          ...tableData.header,
          titleColumn: 'title',
          iconColumn: tableData.header?.iconColumn ?? 'type',
        },
      };
    });
  }

  store.deleteBlock(typedTable);
  return dbId;
}
