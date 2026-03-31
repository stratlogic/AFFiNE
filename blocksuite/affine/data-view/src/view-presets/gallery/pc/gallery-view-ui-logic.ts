import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { signal } from '@preact/signals-core';
import { html,type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  createUniComponentFromWebComponent,
  renderUniLit,
} from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { Property } from '../../../core/view-manager/property.js';
import type { GallerySingleView } from '../gallery-view-manager.js';
import {
  galleryCardContentStyle,
  galleryCardCoverStyle,
  galleryCardPropertyStyle,
  galleryCardStyle,
  galleryGridStyle,
  galleryViewStyle,
} from './gallery-view-style.js';

export class GalleryViewUILogic extends DataViewUILogicBase<
  GallerySingleView,
  any
> {
  ui$ = signal<GalleryViewUI>();

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

  renderer = createUniComponentFromWebComponent(GalleryViewUI);
}

export class GalleryViewUI extends DataViewUIBase<GalleryViewUILogic> {
  override connectedCallback(): void {
    super.connectedCallback();
    this.logic.ui$.value = this;
    this.dataset['testid'] = 'dv-gallery-view';
  }

  private renderCard(row: any) {
    const view = this.logic.view;
    const properties = view.properties$.value;
    const data = view.data$.value;

    let coverStyle = {};
    if (data?.header?.coverPropertyId) {
      const coverCell = view.cellGetOrCreate(
        row.rowId,
        data.header.coverPropertyId
      );
      // Rough hack: if value is an image url, set it. Otherwise fallback to pure colored background.
      const val = coverCell.value$.value as any;
      if (val && typeof val === 'string' && val.startsWith('http')) {
        coverStyle = { backgroundImage: `url(${val})` };
      }
    }

    return html`
      <div
        class="${galleryCardStyle}"
        data-row-id="${row.rowId}"
        @click="${() =>
          this.logic.root.openDetailPanel({ view, rowId: row.rowId })}"
      >
        <div
          class="${galleryCardCoverStyle}"
          style="${styleMap(coverStyle)}"
        ></div>
        <div class="${galleryCardContentStyle}">
          ${repeat(
            properties,
            (prop: Property) => prop.id,
            (prop: Property) => {
              if (prop.id === data?.header?.coverPropertyId) return ''; // don't render cover again
              const cell = view.cellGetOrCreate(row.rowId, prop.id);
              const propertyMeta = view.manager.dataSource.propertyMetaGet(
                prop.type$.value
              );
              if (!propertyMeta)
                return html`<div class="${galleryCardPropertyStyle}">
                  Unsupported
                </div>`;

              const cellRenderer = propertyMeta.renderer.cellRenderer;
              if (!cellRenderer) return html`<div>Unsupported</div>`;

              return html`<div class="${galleryCardPropertyStyle}">
                ${renderUniLit(cellRenderer as any, {
                  property: prop,
                  cell,
                  view,
                })}
              </div>`;
            }
          )}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    const rows = this.logic.view.rows$.value;
    return html`
      <div class="${galleryViewStyle}">
        ${this.logic.headerWidget
          ? renderUniLit(this.logic.headerWidget, {
              dataViewLogic: this.logic,
            })
          : ''}
        <div class="${galleryGridStyle}">
          ${repeat(
            rows,
            row => row.rowId,
            row => this.renderCard(row)
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-gallery-view-ui': GalleryViewUI;
  }
}
