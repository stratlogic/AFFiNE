import {
  menu,
  popMenu,
  type PopupTarget,
} from '@blocksuite/affine-components/context-menu';
import type { Store } from '@blocksuite/store';

export interface DatabaseEntry {
  id: string;
  title: string;
}

/**
 * Returns all `affine:database` blocks visible in the given store.
 * Shared by RelationSettings (config panel) and the linked-database slash command.
 */
export function findAllDatabases(store: Store): DatabaseEntry[] {
  return store.getBlocksByFlavour('affine:database').map(block => ({
    id: block.id,
    title: (block.model as any).props?.title?.toString() || 'Untitled Database',
  }));
}

/**
 * Opens a standalone popup that lists all databases in `store` and calls
 * `onSelect` when the user picks one.
 *
 * Use this for callers that want a fully independent popup (e.g. slash-menu).
 * Callers that render inside a parent `popMenu` via the `menu.*` DSL should
 * use `findAllDatabases` directly and build their own sub-menu items.
 */
export function popDatabasePicker(
  target: PopupTarget,
  store: Store,
  onSelect: (db: DatabaseEntry) => void
): void {
  const databases = findAllDatabases(store);

  const items =
    databases.length === 0
      ? [
          menu.action({
            name: 'No databases found — create a database first',
            // Grey it out so it doesn't appear clickable.
            class: { 'affine-disabled': true },
            select: () => {
              // no-op
            },
          }),
        ]
      : databases.map(db =>
          menu.action({
            name: db.title,
            select: () => {
              onSelect(db);
            },
          })
        );

  popMenu(target, {
    options: {
      title: { text: 'Select a database' },
      items,
    },
  });
}
