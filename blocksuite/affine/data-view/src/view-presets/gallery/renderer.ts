import { createIcon } from '../../core/utils/uni-icon.js';
import type { DataViewUILogicBaseConstructor } from '../../core/view/data-view-base.js';
import { galleryViewModel } from './define.js';
import { GalleryViewUILogic } from './pc/gallery-view-ui-logic.js';

export const galleryViewMeta = galleryViewModel.createMeta({
  icon: createIcon('DatabaseGalleryViewIcon' as any),
  pcLogic: () =>
    GalleryViewUILogic as unknown as DataViewUILogicBaseConstructor,
});
