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
import { html, type TemplateResult } from 'lit';
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
    value: string | TemplateResult,
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
              const id = this.column.view.manager.dataSource.propertyAdd(
                'end',
                {
                  type: 'relation',
                  name: 'New Relation',
                }
              );
              if (id) {
                this.column.dataUpdate(d => ({
                  ...d,
                  relationPropertyId: id,
                }));
              }
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
    let isTargetDbMissing = false;
    let isTargetPropertyMissing = false;

    if (relationPropertyId) {
      const relationData = dataSource.propertyDataGet(
        relationPropertyId
      ) as any;
      const targetDbId = relationData?.targetDatabaseId;
      const store = (dataSource as any).doc as Store;
      if (targetDbId && store) {
        const targetDb = store.getBlock(targetDbId)?.model as any;
        if (targetDb) {
          targetColumns = targetDb.props.columns || [];
        } else {
          isTargetDbMissing = true;
        }
      } else {
        isTargetDbMissing = true;
      }
    }
    const selectedTarget = targetColumns.find(
      col => col.id === targetPropertyId
    );
    if (targetPropertyId && !selectedTarget && !isTargetDbMissing) {
      isTargetPropertyMissing = true;
    }
    const targetName = isTargetDbMissing
      ? '⚠️ Target DB not found'
      : isTargetPropertyMissing
        ? '⚠️ Column not found'
        : selectedTarget?.name || 'Select property';
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
      range: { name: 'Range', info: 'Difference between max and min' },
      count_checked: { name: 'Count checked', info: 'Number of checked items' },
      count_unchecked: {
        name: 'Count unchecked',
        info: 'Number of unchecked items',
      },
      percent_checked: {
        name: 'Percent checked',
        info: 'Percentage of checked items',
      },
      percent_unchecked: {
        name: 'Percent unchecked',
        info: 'Percentage of unchecked items',
      },
      percent_empty: {
        name: 'Percent empty',
        info: 'Percentage of empty cells',
      },
      percent_not_empty: {
        name: 'Percent not empty',
        info: 'Percentage of non-empty cells',
      },
    };

    const allowedCalculations = [
      'count_all',
      'count_values',
      'count_unique',
      'count_empty',
      'count_not_empty',
      'show_original',
      'percent_empty',
      'percent_not_empty',
    ];
    if (targetType === 'number' || targetType === 'progress') {
      allowedCalculations.push('sum', 'average', 'min', 'max', 'range');
    } else if (targetType === 'date') {
      allowedCalculations.push('earliest', 'latest', 'range');
    } else if (targetType === 'checkbox') {
      allowedCalculations.push(
        'count_checked',
        'count_unchecked',
        'percent_checked',
        'percent_unchecked'
      );
    }

    const isValidCalculation =
      !targetType || allowedCalculations.includes(calculation);
    const activeCalculationName = isValidCalculation
      ? calculationMap[calculation]?.name || 'Select calculation'
      : html`<span style="color: var(--affine-error-color)"
          >⚠️ ${calculationMap[calculation]?.name || calculation} (requires
          ${targetType === 'date' ? 'Date' : 'Number'})</span
        >`;

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
                        info:
                          col.type === 'rollup'
                            ? html`<div
                                style="font-size: 10px; color: var(--affine-text-secondary-color);"
                              >
                                Cannot rollup a rollup
                              </div>`
                            : undefined,
                        select: () => {
                          this.column.dataUpdate(d => ({
                            ...d,
                            targetPropertyId: col.id,
                          }));
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
          activeCalculationName,
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
      return html`<span
        style="color: var(--affine-placeholder-color); opacity: 0.5;"
        >—</span
      >`;
    }

    if (this.value instanceof Date) {
      return html`<span>${this.value.toLocaleDateString()}</span>`;
    }

    if (Array.isArray(this.value)) {
      const displayValues = this.value.slice(0, 5);
      const remaining = this.value.length - 5;
      return html`
        <div style="display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0;">
          ${displayValues.map(
            v => html`
              <div
                style="padding: 2px 6px; background: var(--affine-background-secondary-color); border: 1px solid var(--affine-border-color); border-radius: 4px; font-size: 12px; color: var(--affine-text-primary-color); white-space: nowrap;"
              >
                ${v}
              </div>
            `
          )}
          ${remaining > 0
            ? html`<div
                style="padding: 2px 6px; font-size: 12px; color: var(--affine-text-secondary-color); white-space: nowrap;"
              >
                +${remaining} more
              </div>`
            : ''}
        </div>
      `;
    }

    const calculation = (this.cell.property.data$.value as any).calculation;

    if (typeof this.value === 'number') {
      if (calculation.startsWith('percent_')) {
        return html`<div
          style="padding: 2px 6px; background: var(--affine-background-secondary-color); border: 1px solid var(--affine-border-color); border-radius: 4px; font-size: 12px; color: var(--affine-text-primary-color); display: inline-block;"
        >
          ${Math.round(this.value * 100)}%
        </div>`;
      }
      if (calculation === 'range') {
        const data = this.cell.property.data$.value as any;
        const dataSource = this.view.manager.dataSource;
        const relationData = dataSource.propertyDataGet(
          data.relationPropertyId
        ) as any;
        const targetDbId = relationData?.targetDatabaseId;
        const store = (dataSource as any).doc;
        const targetDb = store?.getBlock(targetDbId)?.model as any;
        const targetType = (targetDb?.props.columns as any[])?.find(
          col => col.id === data.targetPropertyId
        )?.type;

        if (targetType === 'date') {
          const days = Math.round(this.value / (1000 * 60 * 60 * 24));
          return html`<div
            style="padding: 2px 6px; background: var(--affine-background-secondary-color); border: 1px solid var(--affine-border-color); border-radius: 4px; font-size: 12px; color: var(--affine-text-primary-color); display: inline-block;"
          >
            ${days} ${days === 1 ? 'day' : 'days'}
          </div>`;
        }
      }
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
