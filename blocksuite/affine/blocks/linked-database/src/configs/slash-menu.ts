import { popupTargetFromElement } from '@blocksuite/affine-components/context-menu';
import { type SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { type DatabaseEntry, popDatabasePicker } from '@blocksuite/data-view';
import { LinkIcon } from '@blocksuite/icons/lit';

/**
 * Slash command for inserting a linked view of an existing database.
 * Uses the shared `popDatabasePicker` so database discovery logic lives in one place.
 */
export const linkedDatabaseSlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => model.flavour === 'affine:database',
  items: [
    {
      name: 'Linked View of Database',
      description: 'Embed a live view of an existing database.',
      searchAlias: ['linked', 'database', 'view'],
      icon: LinkIcon(),
      group: '7_Database@4',
      action: ({ model }) => {
        const store = model.store;
        const el = document.activeElement as HTMLElement | null;
        if (!el) return;

        popDatabasePicker(
          popupTargetFromElement(el),
          store,
          (db: DatabaseEntry) => {
            const parent = store.getParent(model.id);
            if (!parent) return;
            const index = parent.children.indexOf(model) + 1;
            store.addBlock(
              'affine:linked-database',
              { sourceDatabaseId: db.id },
              parent,
              index
            );
          }
        );
      },
    },
  ],
};
