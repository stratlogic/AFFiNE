import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blocksuite/store';

import type { ViewBasicDataType } from '../database/types.js';

export type LinkedDatabaseBlockProps = {
  /** ID of the source `affine:database` block within the same doc. */
  sourceDatabaseId: string;
  /** Local view configurations — independent of the source database's views. */
  views: ViewBasicDataType[];
};

export class LinkedDatabaseBlockModel extends BlockModel<LinkedDatabaseBlockProps> {}

export const LinkedDatabaseBlockSchema = defineBlockSchema({
  flavour: 'affine:linked-database',
  props: (): LinkedDatabaseBlockProps => ({
    sourceDatabaseId: '',
    views: [],
  }),
  metadata: {
    role: 'content',
    version: 1,
    // Same parents as the database block; children are not rows.
    parent: ['affine:note', 'affine:edgeless-text'],
    children: [],
  },
  toModel: () => new LinkedDatabaseBlockModel(),
});

export const LinkedDatabaseBlockSchemaExtension = BlockSchemaExtension(
  LinkedDatabaseBlockSchema
);
