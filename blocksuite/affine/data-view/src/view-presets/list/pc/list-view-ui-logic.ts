import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { signal } from '@preact/signals-core';
import { html,type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { Property } from '../../../core/view-manager/property.js';
import type { ListSingleView } from '../list-view-manager.js';
import {
  listCellContainerStyle,
  listRowStyle,
  listViewStyle,
} from './list-view-style.js';

export class ListViewUILogic extends DataViewUILogicBase<ListSingleView, any> {
  ui$ = signal<ListViewUI>();

  clearSelection = () => {};

  addRow = (position: InsertToPosition) => {
    if (this.view.readonly$.value) return;
    const rowId = this.view.rowAdd(position);
    if (rowId) {
      this.root.openDetailPanel({
        view: this.view,
        rowId,
      });
    }
    return rowId;
  };

  focusFirstCell = () => {};

  showIndicator = (_evt: MouseEvent) => false;
  hideIndicator = () => {};
  moveTo = (_id: string, _evt: MouseEvent) => {};

  renderer = createUniComponentFromWebComponent(ListViewUI);
}

export class ListViewUI extends DataViewUIBase<ListViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.dataset['testid'] = 'dv-list-view';
  }

  private renderRow(row: any) {
    const view = this.logic.view;
    const properties = view.properties$.value;

    // Default to a title render + some cells
    return html`
      <div
        class="${listRowStyle}"
        data-row-id="${row.rowId}"
        @click="${() =>
          this.logic.root.openDetailPanel({ view, rowId: row.rowId })}"
      >
        <div class="${listCellContainerStyle}">
          ${repeat(
            properties,
            (prop: Property) => prop.id,
            (prop: Property) => {
              const cell = view.cellGetOrCreate(row.rowId, prop.id);
              const propertyMeta = view.manager.dataSource.propertyMetaGet(
                prop.type$.value
              );
              if (!propertyMeta) return html`<div>Unsupported</div>`;

              const cellRenderer = propertyMeta.renderer.cellRenderer;
              if (!cellRenderer) return html`<div>Unsupported</div>`;

              return renderUniLit(cellRenderer as any, {
                property: prop,
                cell,
                view,
              });
            }
          )}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const rows = this.logic.view.rows$.value;
    return html`
      <div class="${listViewStyle}">
        ${this.logic.headerWidget
          ? renderUniLit(this.logic.headerWidget, {
              dataViewLogic: this.logic,
            })
          : ''}
        <div class="affine-database-list-rows">
          ${repeat(
            rows,
            row => row.rowId,
            row => this.renderRow(row)
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-list-view-ui': ListViewUI;
  }
}
