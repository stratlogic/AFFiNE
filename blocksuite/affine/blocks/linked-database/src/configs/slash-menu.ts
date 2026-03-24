import { type SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { LinkIcon } from '@blocksuite/icons/lit';

/**
 * Slash command for inserting a linked view of an existing database.
 * Opens a quick search for databases in the current doc.
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
      action: ({ std, model }) => {
        // Query all affine:database blocks in the current doc.
        const store = model.store;
        const allBlocks = store.getBlocksByFlavour('affine:database');
        if (allBlocks.length === 0) {
          const notification = std.getOptional(
            'NotificationProvider' as any
          ) as any;
          notification?.toast(
            'No databases found in this document. Create a database first.'
          );
          return;
        }

        // Build a quick-pick menu from the found databases.
        import('@blocksuite/affine-components/context-menu')
          .then(({ popMenu, popupTargetFromElement, menu: ctxMenu }) => {
            // Find the focused element to anchor the menu.
            const el = document.activeElement as HTMLElement | null;
            if (!el) return;

            popMenu(popupTargetFromElement(el), {
              options: {
                title: { text: 'Select a database' },
                items: allBlocks.map(
                  (block: { id: string; model: Record<string, any> }) =>
                    ctxMenu.action({
                      name:
                        block.model['props']?.title?.toString() ||
                        'Untitled Database',
                      select: () => {
                        // Insert linked-database block after the current model.
                        const parent = store.getParent(model.id);
                        if (!parent) return;
                        const index = parent.children.indexOf(model) + 1;
                        store.addBlock(
                          'affine:linked-database',
                          { sourceDatabaseId: block.id },
                          parent,
                          index
                        );
                      },
                    })
                ),
              },
            });
          })
          .catch(console.error);
      },
    },
  ],
};
