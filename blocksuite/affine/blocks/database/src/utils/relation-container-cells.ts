import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { BlockModel } from '@blocksuite/store';

import { getCell, updateCell } from './block-utils.js';

/** Read relation cell value (`string[]`) from either a database or a data-view block. */
export function getRelationIdsFromContainer(
  container: BlockModel,
  rowId: string,
  columnId: string
): string[] {
  if (container.flavour === 'affine:database') {
    const cell = getCell(container as DatabaseBlockModel, rowId, columnId);
    return (Array.isArray(cell?.value) ? cell.value : []) as string[];
  }
  if (container.flavour === 'affine:data-view') {
    const raw = (
      container as {
        props: { cells?: Record<string, Record<string, unknown>> };
      }
    ).props.cells?.[rowId]?.[columnId];
    return Array.isArray(raw) ? (raw as string[]) : [];
  }
  return [];
}

/** Write relation cell value (`string[]`) for database (Yjs cell shape) or data-view (raw map). */
export function setRelationIdsOnContainer(
  container: BlockModel,
  rowId: string,
  columnId: string,
  ids: string[]
): void {
  if (container.flavour === 'affine:database') {
    updateCell(container as DatabaseBlockModel, rowId, {
      columnId,
      value: ids,
    });
    return;
  }
  if (container.flavour === 'affine:data-view') {
    const m = container as unknown as {
      store: { transact: (fn: () => void) => void };
      props: { cells: Record<string, Record<string, unknown>> };
    };
    m.store.transact(() => {
      if (!m.props.cells[rowId]) {
        m.props.cells[rowId] = Object.create(null);
      }
      m.props.cells[rowId] = { ...m.props.cells[rowId], [columnId]: ids };
    });
  }
}

export function updateColumnRelationData(
  container: BlockModel,
  columnId: string,
  updater: (data: Record<string, unknown>) => Record<string, unknown>
): void {
  if (container.flavour === 'affine:database') {
    const model = container as DatabaseBlockModel;
    const index = model.props.columns.findIndex(c => c.id === columnId);
    if (index < 0) return;
    model.store.transact(() => {
      const col = model.props.columns[index]!;
      model.props.columns[index] = {
        ...col,
        data: updater((col.data ?? {}) as Record<string, unknown>),
      };
    });
    return;
  }
  if (container.flavour === 'affine:data-view') {
    const m = container as unknown as {
      store: { transact: (fn: () => void) => void };
      props: {
        columns: Array<
          { id: string; data?: Record<string, unknown> } & Record<
            string,
            unknown
          >
        >;
      };
    };
    const index = m.props.columns.findIndex(c => c.id === columnId);
    if (index < 0) return;
    m.store.transact(() => {
      const col = m.props.columns[index]!;
      m.props.columns[index] = {
        ...col,
        data: updater((col.data ?? {}) as Record<string, unknown>),
      };
    });
  }
}
