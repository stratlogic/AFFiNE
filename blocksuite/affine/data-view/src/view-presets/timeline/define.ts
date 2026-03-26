import { createIcon } from '../../core/utils/uni-icon.js';
import { viewType } from '../../core/view-manager/view-type.js';
import { TimelineSingleView } from './timeline-view-manager.js';

export const timelineViewType = viewType('timeline');

export const timelineViewModel = timelineViewType.createModel({
  defaultName: 'Timeline',
  dataViewManager: TimelineSingleView,
  defaultData: () => ({
    startPropertyId: '',
    endPropertyId: '',
    zoomLevel: 'month',
    visibleColumns: [],
    filter: { type: 'group', op: 'and', conditions: [] },
    sort: [],
  }),
});

export const timelineViewMeta = timelineViewModel.createPropertyMeta({
  icon: createIcon('TimelineIcon'),
});
