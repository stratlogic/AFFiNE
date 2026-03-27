import '@blocksuite/affine-components/toggle-switch';

import {
  menu,
  renderSubMenu,
  subMenuMiddleware,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Store } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

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

  @property({ attribute: false })
  accessor menu!: any;

  private readonly _relationSearch$ = signal('');
  private readonly _propertySearch$ = signal('');

  private renderSubMenuRow(
    label: string,
    value: string,
    title: string,
    items: any[],
    disabled = false
  ) {
    if (disabled) {
      return html`
        <div
          style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; opacity: 0.5; pointer-events: none;"
        >
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div
              style="font-size: 10px; color: var(--affine-text-secondary-color);"
            >
              ${label}
            </div>
            <div style="font-size: 14px;">${value}</div>
          </div>
          <uni-lit .uni="${createIcon('ArrowRightSmallIcon')}"></uni-lit>
        </div>
      `;
    }

    return renderSubMenu(
      {
        content: () => html`
          <div
            style="display: flex; flex-direction: column; gap: 2px; flex: 1; text-align: left;"
          >
            <div
              style="font-size: 10px; color: var(--affine-text-secondary-color);"
            >
              ${label}
            </div>
            <div
              style="font-size: 14px; color: var(--affine-text-primary-color);"
            >
              ${value}
            </div>
          </div>
          <uni-lit .uni="${createIcon('ArrowRightSmallIcon')}"></uni-lit>
        `,
        options: {
          title: { text: title },
          items,
        },
        middleware: subMenuMiddleware,
      },
      this.menu
    );
  }

  override render() {
    const data = this.column.data$.value as any;
    const relationPropertyId = data.relationPropertyId;
    const targetPropertyId = data.targetPropertyId;
    const calculation = data.calculation || 'show_original';

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
        <div
          style="padding: 8px; color: var(--affine-text-secondary-color); display: flex; flex-direction: column; gap: 8px;"
        >
          <div>No relation columns found</div>
          <div
            class="dv-hover"
            style="padding: 4px 8px; border-radius: 4px; cursor: pointer; color: var(--affine-primary-color); font-size: 14px; background: var(--affine-background-secondary-color); text-align: center;"
            @click="${() => {
              this.column.view.manager.dataSource.propertyAdd('end', {
                type: 'relation',
                name: 'New Relation',
              });
            }}"
          >
            Add Relation Property
          </div>
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
      const relationData = dataSource.propertyDataGet(
        relationPropertyId
      ) as any;
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
    const selectedTarget = targetColumns.find(
      col => col.id === targetPropertyId
    );
    const targetName = selectedTarget?.name || 'Select property';
    const targetType = selectedTarget?.type || '';

    // Calculations
    const calculationMap: Record<string, { name: string; info?: string }> = {
      count_all: { name: 'Count all', info: 'Total number of rows' },
      count_values: { name: 'Count values', info: 'Number of non-empty cells' },
      count_unique: { name: 'Count unique', info: 'Number of unique values' },
      count_empty: { name: 'Count empty', info: 'Number of empty cells' },
      count_not_empty: {
        name: 'Count not empty',
        info: 'Number of non-empty cells',
      },
      show_original: { name: 'Show original', info: 'List all values' },
      sum: { name: 'Sum', info: 'Total of all numbers' },
      average: { name: 'Average', info: 'Mean of all numbers' },
      min: { name: 'Min', info: 'Smallest value' },
      max: { name: 'Max', info: 'Largest value' },
      earliest: { name: 'Earliest', info: 'First date' },
      latest: { name: 'Latest', info: 'Last date' },
    };

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
        ${this.renderSubMenuRow('Relation', relationName, 'Select a relation', [
          menu.input({
            initialValue: '',
            placeholder: 'Search relations...',
            onChange: val => {
              this._relationSearch$.value = val;
            },
          }),
          menu.group({
            items: [
              menu.dynamic(() => {
                const filter = this._relationSearch$.value.toLowerCase();
                return relationColumns
                  .filter(col =>
                    (col.name || col.id).toLowerCase().includes(filter)
                  )
                  .map(col =>
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
                  );
              }),
            ],
          }),
        ])}

        <!-- Property -->
        ${this.renderSubMenuRow(
          'Property',
          targetName,
          'Select a property',
          [
            menu.input({
              initialValue: '',
              placeholder: 'Search properties...',
              onChange: val => {
                this._propertySearch$.value = val;
              },
            }),
            menu.group({
              items: [
                menu.dynamic(() => {
                  const filter = this._propertySearch$.value.toLowerCase();
                  return targetColumns
                    .filter(col =>
                      (col.name || col.id).toLowerCase().includes(filter)
                    )
                    .map(col =>
                      menu.action({
                        name: col.name || col.id,
                        isSelected: col.id === targetPropertyId,
                        select: () => {
                          this.column.dataUpdate(d => ({
                            ...d,
                            targetPropertyId: col.id,
                          }));
                          this.menu?.close();
                        },
                      })
                    );
                }),
              ],
            }),
          ],
          !relationPropertyId
        )}

        <!-- Calculation -->
        ${this.renderSubMenuRow(
          'Calculate',
          calculationMap[calculation]?.name || 'Select calculation',
          'Select calculation',
          allowedCalculations.map(calc =>
            menu.action({
              name: calculationMap[calc]?.name || calc.replace(/_/g, ' '),
              info: calculationMap[calc]?.info
                ? html`<div
                    style="font-size: 10px; color: var(--affine-text-secondary-color);"
                  >
                    ${calculationMap[calc].info}
                  </div>`
                : undefined,
              isSelected: calc === calculation,
              select: () => {
                this.column.dataUpdate(d => ({
                  ...d,
                  calculation: calc,
                }));
                this.menu?.close();
              },
            })
          ),
          !targetPropertyId
        )}
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
                style="padding: 2px 6px; background: var(--affine-background-secondary-color); border: 1px solid var(--affine-border-color); border-radius: 4px; font-size: 12px; color: var(--affine-text-primary-color); white-space: nowrap;"
              >
                ${v}
              </div>
            `
          )}
        </div>
      `;
    }

    return html`<div
      style="padding: 2px 6px; background: var(--affine-background-secondary-color); border: 1px solid var(--affine-border-color); border-radius: 4px; font-size: 12px; color: var(--affine-text-primary-color); display: inline-block;"
    >
      ${this.value}
    </div>`;
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
