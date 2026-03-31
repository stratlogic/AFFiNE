import { createIcon } from '../../core/utils/uni-icon.js';
import { type DataViewUILogicBaseConstructor } from '../../core/view/data-view-base.js';
import { listViewModel } from './define.js';
import { ListViewUILogic } from './pc/list-view-ui-logic.js';

export const listViewMeta = listViewModel.createMeta({
  icon: createIcon('DatabaseListViewIcon'),
  pcLogic: () => ListViewUILogic as unknown as DataViewUILogicBaseConstructor,
});
