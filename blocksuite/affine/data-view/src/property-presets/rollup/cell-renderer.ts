import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Store } from '@blocksuite/store';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

import '@blocksuite/affine-components/toggle-switch';

import { BaseCellRenderer } from '../../core/property/index.js';
import { createFromBaseCellRenderer } from '../../core/property/renderer.js';
import { createUniComponentFromWebComponent } from '../../core/utils/uni-component/index.js';
import { createIcon } from '../../core/utils/uni-icon.js';
import type { TableProperty } from '../../view-presets/table/table-view-manager.js';
import { rollupPropertyModelConfig } from './define.js';

export class RollupSettings extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  @property({ attribute: false })
  accessor column!: TableProperty;

  private popMenu(
    name: string,
    items: any[],
    e: MouseEvent,
    title?: string
  ) {
    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options: {
        title: title ? { text: title } : undefined,
        items,
      },
    });
  }

  override render() {
    const data = this.column.data$.value as any;
    const relationPropertyId = data.relationPropertyId;
    const targetPropertyId = data.targetPropertyId;
    const calculation = data.calculation;

    const dataSource = this.column.view.manager.dataSource;
    const propertyIds = dataSource.properties$.value;
    const relationColumns = propertyIds
      .filter(id => dataSource.propertyTypeGet(id) === 'relation')
      .map(id => ({
        id,
        name: dataSource.propertyNameGet(id),
      }));

    if (relationColumns.length === 0) {
      return html`
        <div style="padding: 8px; color: var(--affine-text-secondary-color);">
          No relation columns found
        </div>
      `;
    }

    const selectedRelation = relationColumns.find(
      col => col.id === relationPropertyId
    );
    const relationName = selectedRelation?.name || 'Select relation';

    // Target Properties
    let targetColumns: any[] = [];
    if (relationPropertyId) {
      const relationData = dataSource.propertyDataGet(relationPropertyId) as any;
      const targetDbId = relationData?.targetDatabaseId;
      const store = (dataSource as any).doc as Store;
      if (targetDbId && store) {
        const targetDb = store.getBlock(targetDbId)?.model as any;
        if (targetDb) {
          targetColumns = (targetDb.props.columns || []).filter(
            (col: any) => col.type !== 'rollup'
          );
        }
      }
    }
    const selectedTarget = targetColumns.find(col => col.id === targetPropertyId);
    const targetName = selectedTarget?.name || 'Select property';
    const targetType = selectedTarget?.type || '';

    // Calculations
    const allowedCalculations = [
      'count_all',
      'count_values',
      'count_unique',
      'count_empty',
      'count_not_empty',
      'show_original',
    ];
    if (targetType === 'number' || targetType === 'progress') {
      allowedCalculations.push('sum', 'average', 'min', 'max');
    } else if (targetType === 'date') {
      allowedCalculations.push('earliest', 'latest');
    }

    return html`
      <div
        style="display: flex; flex-direction: column; gap: 4px; padding: 4px;"
      >
        <!-- Relation -->
        <div
          class="dv-hover"
          style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; cursor: pointer;"
          @click="${(e: MouseEvent) =>
            this.popMenu(
              'Relation',
              relationColumns.map(col =>
                menu.action({
                  name: col.name || col.id,
                  isSelected: col.id === relationPropertyId,
                  select: () => {
                    this.column.dataUpdate(d => ({
                      ...d,
                      relationPropertyId: col.id,
                      targetPropertyId: '',
                    }));
                  },
                })
              ),
              e,
              'Select a relation'
            )}"
        >
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div
              style="font-size: 10px; color: var(--affine-text-secondary-color);"
            >
              Relation
            </div>
            <div style="font-size: 14px;">${relationName}</div>
          </div>
          <uni-lit .uni="${createIcon('ArrowRightSmallIcon')}"></uni-lit>
        </div>

        <!-- Property -->
        <div
          class="dv-hover"
          style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; cursor: pointer; ${!relationPropertyId
            ? 'opacity: 0.5; pointer-events: none;'
            : ''}"
          @click="${(e: MouseEvent) =>
            this.popMenu(
              'Property',
              targetColumns.map(col =>
                menu.action({
                  name: col.name || col.id,
                  isSelected: col.id === targetPropertyId,
                  select: () => {
                    this.column.dataUpdate(d => ({
                      ...d,
                      targetPropertyId: col.id,
                    }));
                  },
                })
              ),
              e,
              'Select a property'
            )}"
        >
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div
              style="font-size: 10px; color: var(--affine-text-secondary-color);"
            >
              Property
            </div>
            <div style="font-size: 14px;">${targetName}</div>
          </div>
          <uni-lit .uni="${createIcon('ArrowRightSmallIcon')}"></uni-lit>
        </div>

        <!-- Calculation -->
        <div
          class="dv-hover"
          style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; cursor: pointer; ${!targetPropertyId
            ? 'opacity: 0.5; pointer-events: none;'
            : ''}"
          @click="${(e: MouseEvent) =>
            this.popMenu(
              'Calculate',
              allowedCalculations.map(calc =>
                menu.action({
                  name: calc.replace(/_/g, ' '),
                  isSelected: calc === calculation,
                  select: () => {
                    this.column.dataUpdate(d => ({
                      ...d,
                      calculation: calc,
                    }));
                  },
                })
              ),
              e,
              'Select calculation'
            )}"
        >
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div
              style="font-size: 10px; color: var(--affine-text-secondary-color);"
            >
              Calculate
            </div>
            <div style="font-size: 14px;">${calculation.replace(/_/g, ' ')}</div>
          </div>
          <uni-lit .uni="${createIcon('ArrowRightSmallIcon')}"></uni-lit>
        </div>
      </div>
    `;
  }
}

const RollupSettingsUni = createUniComponentFromWebComponent<{
  column: TableProperty;
}>(RollupSettings);

export class RollupCell extends BaseCellRenderer<any> {
  override render() {
    if (
      this.value == null ||
      (Array.isArray(this.value) && this.value.length === 0)
    ) {
      return html`<span style="color: var(--affine-placeholder-color);"
        >Empty</span
      >`;
    }

    if (this.value instanceof Date) {
      return html`<span>${this.value.toLocaleDateString()}</span>`;
    }

    if (Array.isArray(this.value)) {
      return html`
        <div style="display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0;">
          ${this.value.map(
            v => html`
              <div
                style="padding: 2px 6px; background: var(--affine-background-tertiary-color); border-radius: 4px; font-size: 12px;"
              >
                ${v}
              </div>
            `
          )}
        </div>
      `;
    }

    return html`<span>${this.value}</span>`;
  }
}

export const rollupPropertyConfig =
  rollupPropertyModelConfig.createPropertyMeta({
    icon: createIcon('LinkIcon'),
    cellRenderer: {
      view: createFromBaseCellRenderer(RollupCell),
    },
    settings: RollupSettingsUni,
  });
