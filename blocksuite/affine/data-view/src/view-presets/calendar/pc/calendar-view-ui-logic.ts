import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { signal } from '@preact/signals-core';
import { html } from 'lit';

import { createUniComponentFromWebComponent } from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { CalendarSingleView } from '../calendar-view-manager.js';

export class CalendarViewUILogic extends DataViewUILogicBase<
  CalendarSingleView,
  any
> {
  ui$ = signal<CalendarViewUI | undefined>(undefined);

  clearSelection = () => {};
  addRow = (_position: InsertToPosition): string | undefined => {
    return undefined;
  };
  focusFirstCell = () => {};

  showIndicator = (_evt: MouseEvent) => false;
  hideIndicator = () => {};
  moveTo = (_id: string, _evt: MouseEvent) => {};

  renderer = createUniComponentFromWebComponent(CalendarViewUI);
}

export class CalendarViewUI extends DataViewUIBase<CalendarViewUILogic> {
  override connectedCallback() {
    super.connectedCallback();
    this.logic.ui$.value = this;
  }

  override render() {
    return html`<calendar-view .view="${this.logic.view}"></calendar-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-calendar-view-ui': CalendarViewUI;
  }
}
