import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import { signal } from '@preact/signals-core';
import { html } from 'lit';

import { createUniComponentFromWebComponent } from '../../../core/index.js';
import {
  DataViewUIBase,
  DataViewUILogicBase,
} from '../../../core/view/data-view-base.js';
import type { TimelineSingleView } from '../timeline-view-manager.js';

export class TimelineViewUILogic extends DataViewUILogicBase<
  TimelineSingleView,
  any
> {
  ui$ = signal<TimelineViewUI | undefined>(undefined);

  clearSelection = () => {};
  addRow = (_position: InsertToPosition): string | undefined => {
    return undefined;
  };
  focusFirstCell = () => {};

  showIndicator = (_evt: MouseEvent) => false;
  hideIndicator = () => {};
  moveTo = (_id: string, _evt: MouseEvent) => {};

  renderer = createUniComponentFromWebComponent(TimelineViewUI);
}

export class TimelineViewUI extends DataViewUIBase<TimelineViewUILogic> {
  override connectedCallback() {
    super.connectedCallback();
    this.logic.ui$.value = this;
  }

  override render() {
    return html`<timeline-view .view="${this.logic.view}"></timeline-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-timeline-view-ui': TimelineViewUI;
  }
}
