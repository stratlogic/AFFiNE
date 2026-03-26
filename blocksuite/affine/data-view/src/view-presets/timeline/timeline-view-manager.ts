import { computed } from '@preact/signals-core';

import { emptyFilterGroup } from '../../core/filter/utils.js';
import { PropertyBase } from '../../core/view-manager/property.js';
import { SingleViewBase } from '../../core/view-manager/single-view.js';

export class TimelineSingleView extends SingleViewBase {
  get type() {
    return 'timeline';
  }

  readonly$ = computed(() => {
    return this.manager.readonly$.value;
  });

  startPropertyId$ = computed(() => {
    return (this.data$.value as any).startPropertyId as string | undefined;
  });

  endPropertyId$ = computed(() => {
    return (this.data$.value as any).endPropertyId as string | undefined;
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
    return true;
  }

  propertyGetOrCreate(propertyId: string): TimelineProperty {
    return new TimelineProperty(this, propertyId);
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

  updateStartProperty(propertyId: string) {
    this.dataUpdate(d => ({
      ...d,
      startPropertyId: propertyId,
    }));
  }

  updateEndProperty(propertyId: string) {
    this.dataUpdate(d => ({
      ...d,
      endPropertyId: propertyId,
    }));
  }
}

export class TimelineProperty extends PropertyBase {
  hide$ = computed(() => false);
  override move(): void {}
  override hideSet(): void {}
}
