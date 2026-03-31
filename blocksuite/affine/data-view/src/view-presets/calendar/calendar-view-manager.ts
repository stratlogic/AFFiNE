import { computed } from '@preact/signals-core';

import { emptyFilterGroup } from '../../core/filter/utils.js';
import { PropertyBase } from '../../core/view-manager/property.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';

export class CalendarSingleView extends SingleViewBase {
  get type() {
    return 'calendar';
  }

  readonly$ = computed(() => {
    return this.manager.readonly$.value;
  });

  datePropertyId$ = computed(() => {
    return (this.data$.value as any).datePropertyId as string | undefined;
  });

  propertiesRaw$ = computed(() => {
    return this.dataSource.properties$.value.map(id =>
      this.propertyGetOrCreate(id)
    );
  });

  properties$ = computed(() => {
    return this.propertiesRaw$.value.filter(property => !property.hide$.value);
  });

  detailProperties$ = computed(() => {
    return this.propertiesRaw$.value.filter(
      property => property.type$.value !== 'title'
    );
  });

  mainProperties$ = computed(() => {
    return {
      titleColumn: this.propertiesRaw$.value.find(
        property => property.type$.value === 'title'
      )?.id,
    };
  });

  filter$ = computed(() => {
    return this.data$.value?.filter ?? emptyFilterGroup;
  });

  isShow(_rowId: string): boolean {
    // Basic implementation, can be expanded with filter evaluation later
    return true;
  }

  propertyGetOrCreate(propertyId: string): CalendarProperty {
    return new CalendarProperty(this, propertyId);
  }

  getAvailableDateProperties() {
    return this.dataSource.properties$.value
      .filter(id => {
        return this.dataSource.propertyTypeGet(id) === 'date';
      })
      .map(id => ({
        id,
        name: this.dataSource.propertyNameGet(id),
      }));
  }

  updateDateProperty(propertyId: string) {
    this.dataUpdate(d => ({
      ...d,
      datePropertyId: propertyId,
    }));
  }
}

export class CalendarProperty extends PropertyBase {
  hide$ = computed(() => {
    return false; // Default to shown for now
  });

  override move(): void {
    // No-op for now
  }

  override hideSet(): void {
    // No-op for now
  }
}
