import type { FilterGroup } from '../../core/filter/types.js';
import type { Sort } from '../../core/sort/types.js';
import { type BasicViewDataType, viewType } from '../../core/view/data-view.js';
import { GallerySingleView } from './gallery-view-manager.js';

export const galleryViewType = viewType('gallery');

export type GalleryViewColumn = {
  id: string; // The property id
  hide?: boolean;
};

type DataType = {
  columns: GalleryViewColumn[];
  filter: FilterGroup;
  sort?: Sort;
  header?: {
    titleColumn?: string;
    iconColumn?: string;
    coverPropertyId?: string; // which property to use as cover
  };
  cardSize?: 'small' | 'medium' | 'large';
};

export type GalleryViewData = BasicViewDataType<
  typeof galleryViewType.type,
  DataType
>;

export const galleryViewModel = galleryViewType.createModel<GalleryViewData>({
  defaultName: 'Gallery View',
  dataViewManager: GallerySingleView,
  defaultData: viewManager => {
    return {
      mode: 'gallery',
      columns: [],
      filter: {
        type: 'group',
        op: 'and',
        conditions: [],
      },
      header: {
        titleColumn: viewManager.dataSource.properties$.value.find(
          id => viewManager.dataSource.propertyTypeGet(id) === 'title'
        ),
      },
      cardSize: 'medium',
    };
  },
});
