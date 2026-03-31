import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { computed, type ReadonlySignal } from '@preact/signals-core';

import {
  type Property,
  PropertyBase,
} from '../../core/view-manager/property.js';
import type { MainProperties } from '../../core/view-manager/single-view.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';
import type { ListViewData } from './define.js';

class ListProperty extends PropertyBase {
  override get hide$() {
    return computed(() => {
      const data = this.view.data$.value as ListViewData | undefined;
      return !!data?.columns?.find(c => c.id === this.id)?.hide;
    });
  }
  override hideSet(hide: boolean) {
    (this.view as ListSingleView).dataUpdate((data: ListViewData) => {
      const cols = data.columns ? [...data.columns] : [];
      let col = cols.find(c => c.id === this.id);
      if (!col) {
        col = { id: this.id };
        cols.push(col);
      }
      col.hide = hide;
      return { columns: cols } as Partial<ListViewData>;
    });
  }
  override move(_position: InsertToPosition) {
    // Basic implementation for MVP
  }
}

export class ListSingleView extends SingleViewBase<ListViewData> {
  override get type(): string {
    return 'list';
  }

  override get detailProperties$(): ReadonlySignal<Property[]> {
    return this.properties$;
  }

  override get mainProperties$(): ReadonlySignal<MainProperties> {
    return computed(() => {
      return {
        titleColumn: this.data$.value?.header?.titleColumn,
        iconColumn: this.data$.value?.header?.iconColumn,
      } as MainProperties;
    });
  }

  override get propertiesRaw$(): ReadonlySignal<Property[]> {
    return computed(() => {
      const allIds = this.dataSource.properties$.value;
      const columns = this.data$.value?.columns ?? [];
      const columnIds = new Set(columns.map(c => c.id));
      const result = columns.map(c => c.id).filter(id => allIds.includes(id));
      allIds.forEach(id => {
        if (!columnIds.has(id)) {
          result.push(id);
        }
      });
      return result.map(id => this.propertyGetOrCreate(id));
    });
  }

  override get properties$(): ReadonlySignal<Property[]> {
    return computed(() => {
      return this.propertiesRaw$.value.filter((property: Property) => {
        return !this.data$.value?.columns?.find(c => c.id === property.id)
          ?.hide;
      });
    });
  }

  override get readonly$(): ReadonlySignal<boolean> {
    return this.dataSource.readonly$;
  }

  override isShow(_rowId: string): boolean {
    return true; // Simplified for MVP List View
  }

  override propertyGetOrCreate(propertyId: string): Property {
    return new ListProperty(this, propertyId);
  }
}
