import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';
import { LinkedDatabaseBlockSchemaExtension } from '@blocksuite/affine-model';
import { SlashMenuConfigExtension } from '@blocksuite/affine-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blocksuite/std';
import { literal } from 'lit/static-html.js';

import { linkedDatabaseSlashMenuConfig } from './configs/slash-menu.js';
import { effects } from './effects.js';

export class LinkedDatabaseViewExtension extends ViewExtensionProvider {
  override name = 'affine-linked-database-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      LinkedDatabaseBlockSchemaExtension,
      FlavourExtension('affine:linked-database'),
      BlockViewExtension(
        'affine:linked-database',
        literal`affine-linked-database`
      ),
      SlashMenuConfigExtension(
        'affine:linked-database',
        linkedDatabaseSlashMenuConfig
      ),
    ]);
  }
}
