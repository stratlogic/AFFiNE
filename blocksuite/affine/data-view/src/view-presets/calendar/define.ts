import { createIcon } from '../../core/utils/uni-icon.js';
import { viewType } from '../../core/view/data-view.js';
import { CalendarSingleView } from './calendar-view-manager.js';
import { CalendarViewUILogic } from './pc/calendar-view-ui-logic.js';

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

export const calendarViewMeta = calendarViewModel.createMeta({
  icon: createIcon('TodayIcon'),
  pcLogic: () => CalendarViewUILogic as any,
});
