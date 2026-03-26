import { createIcon } from '../../core/utils/uni-icon.js';
import { viewType } from '../../core/view-manager/view-type.js';
import { CalendarSingleView } from './calendar-view-manager.js';

export const calendarViewType = viewType('calendar');

export const calendarViewModel = calendarViewType.createModel({
  defaultName: 'Calendar',
  dataViewManager: CalendarSingleView,
  defaultData: () => ({
    datePropertyId: '',
    visibleColumns: [],
    filter: { type: 'group', op: 'and', conditions: [] },
    sort: [],
  }),
});

export const calendarViewMeta = calendarViewModel.createPropertyMeta({
  icon: createIcon('CalendarIcon'),
});
