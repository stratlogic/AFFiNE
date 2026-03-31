import { calendarViewMeta } from './calendar/index.js';
import { galleryViewMeta } from './gallery/index.js';
import { kanbanViewMeta } from './kanban/index.js';
import { listViewMeta } from './list/index.js';
import { tableViewMeta } from './table/index.js';
import { timelineViewMeta } from './timeline/index.js';

export * from './calendar/index.js';
export * from './convert.js';
export * from './gallery/index.js';
export * from './kanban/index.js';
export * from './list/index.js';
export * from './table/index.js';
export * from './timeline/index.js';

export const viewPresets = {
  calendarViewMeta,
  kanbanViewMeta,
  listViewMeta,
  galleryViewMeta,
  tableViewMeta,
  timelineViewMeta,
};
