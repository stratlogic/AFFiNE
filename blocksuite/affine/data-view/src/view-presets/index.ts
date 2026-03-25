import { galleryViewMeta } from './gallery/index.js';
import { kanbanViewMeta } from './kanban/index.js';
import { listViewMeta } from './list/index.js';
import { tableViewMeta } from './table/index.js';

export * from './convert.js';
export * from './gallery/index.js';
export * from './kanban/index.js';
export * from './list/index.js';
export * from './table/index.js';

export const viewPresets = {
  kanbanViewMeta,
  listViewMeta,
  galleryViewMeta,
  tableViewMeta,
};
