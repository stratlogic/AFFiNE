import { menu } from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
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

  override render() {
    const data = this.column.data$.value as any;
    const relationPropertyId = data.relationPropertyId;
    const targetPropertyId = data.targetPropertyId;
    const calculation = data.calculation;

    const dataSource = this.column.view.manager.dataSource as any;
    const allColumns = (dataSource._model?.props?.columns || []) as any[];
    const relationColumns = allColumns.filter(col => col.type === 'relation');

    if (relationColumns.length === 0) {
      return menu.group({
        items: [
          menu.action({
            name: 'No relation columns found',
            prefix: createIcon('InfoIcon'),
            select: () => false,
          }),
        ],
      });
    }

    // Step 1: Select Relation
    const relationMenu = menu.subMenu({
      name: 'Relation',
      prefix: createIcon('LinkIcon'),
      options: {
        title: { text: 'Select a relation' },
        items: relationColumns.map(col =>
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
      },
    });

    // Step 2: Select Target Property
    let targetPropertyMenu = null;
    let targetType = '';
    if (relationPropertyId) {
      const relationCol = allColumns.find(col => col.id === relationPropertyId);
      const targetDbId = relationCol?.data?.targetDatabaseId;
      if (targetDbId) {
        const targetDb = dataSource.doc.getBlock(targetDbId)?.model;
        if (targetDb) {
          const targetColumns = (targetDb.props.columns || []) as any[];
          const selectedTargetCol = targetColumns.find(
            col => col.id === targetPropertyId
          );
          targetType = selectedTargetCol?.type || '';

          targetPropertyMenu = menu.subMenu({
            name: 'Property',
            prefix: createIcon('SearchIcon'),
            options: {
              title: { text: 'Select a property' },
              items: targetColumns
                .filter(col => col.type !== 'rollup')
                .map(col =>
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
            },
          });
        }
      }
    }

    // Step 3: Select Calculation
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

    const calculationMenu = menu.subMenu({
      name: 'Calculate',
      prefix: createIcon('SettingsIcon'),
      options: {
        title: { text: 'Select calculation' },
        items: allowedCalculations.map(calc =>
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
      },
    });

    const items = [relationMenu];
    if (targetPropertyMenu) {
      items.push(targetPropertyMenu);
    }
    items.push(calculationMenu);

    return menu.group({ items });
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
