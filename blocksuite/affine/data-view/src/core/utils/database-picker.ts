import {
  menu,
  popMenu,
  type PopupTarget,
} from '@blocksuite/affine-components/context-menu';
import type { Store } from '@blocksuite/store';

export interface DatabaseEntry {
  id: string;
  title: string;
  docTitle?: string;
  /** Page containing the database; omit when same as `store.id`. */
  sourceDocId?: string;
}

/**
 * Returns all `affine:database` blocks visible in the given store.
 * Shared by RelationSettings (config panel) and the linked-database slash command.
 */
export function findAllDatabases(store: Store): DatabaseEntry[] {
  const docId = store.id;
  const docMeta = store.workspace.meta.docMetas.find(m => m.id === docId);
  const docTitle = docMeta?.title;

  return store.getBlocksByFlavour('affine:database').map(block => ({
    id: block.id,
    title: (block.model as any).props?.title?.toString() || 'Untitled Database',
    docTitle,
  }));
}

/**
 * All `affine:database` blocks across every loaded page in the workspace (for cross-doc relations).
 */
export function findAllDatabasesInWorkspace(store: Store): DatabaseEntry[] {
  const out: DatabaseEntry[] = [];
  for (const meta of store.workspace.meta.docMetas) {
    const doc = store.workspace.getDoc(meta.id);
    if (!doc) {
      continue;
    }
    let subStore: Store;
    try {
      subStore = doc.getStore({ id: meta.id });
    } catch {
      continue;
    }
    const pageTitle = meta.title;
    for (const block of subStore.getBlocksByFlavour('affine:database')) {
      out.push({
        id: block.id,
        title: (block.model as any).props?.title?.toString() || 'Untitled Database',
        docTitle: pageTitle,
        sourceDocId: meta.id === store.id ? undefined : meta.id,
      });
    }
  }
  return out;
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
