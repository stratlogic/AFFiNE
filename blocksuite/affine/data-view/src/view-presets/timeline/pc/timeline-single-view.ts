import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type { TimelineSingleView } from '../timeline-view-manager.js';

export class TimelineView extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  @property({ attribute: false })
  accessor view!: TimelineSingleView;

  private readonly _startDate = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  );
  private readonly _daysToShow = 30;
  private readonly _dayWidth = 60;

  override render() {
    const startPropertyId = this.view.startPropertyId$.value;
    if (!startPropertyId) {
      return html`<div style="padding: 20px; text-align: center;">
        Please select a start date property.
      </div>`;
    }

    const days = Array.from({ length: this._daysToShow }, (_, i) => {
      const d = new Date(this._startDate);
      d.setDate(d.getDate() + i);
      return d;
    });

    const titleColumnId = this.view.mainProperties$.value.titleColumn;

    return html`
      <div
        class="affine-timeline-view"
        style="display: flex; height: 100%; border-top: 1px solid var(--affine-border-color); overflow: hidden;"
      >
        <!-- Sticky Row Labels -->
        <div
          class="row-labels"
          style="width: 200px; flex-shrink: 0; border-right: 1px solid var(--affine-border-color); background: var(--affine-background-primary-color); z-index: 1;"
        >
          <div
            style="height: 40px; border-bottom: 2px solid var(--affine-border-color);"
          ></div>
          ${repeat(
            this.view.rows$.value,
            row => row.rowId,
            row => {
              const title = titleColumnId
                ? this.view.cellGetOrCreate(row.rowId, titleColumnId)
                    .stringValue$.value
                : 'Untitled';
              return html`
                <div
                  style="height: 40px; padding: 0 12px; display: flex; align-items: center; border-bottom: 1px solid var(--affine-border-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                >
                  ${title || 'Untitled'}
                </div>
              `;
            }
          )}
        </div>

        <!-- Scrollable Timeline Grid -->
        <div
          class="timeline-scroll"
          style="flex-grow: 1; overflow-x: auto; background: var(--affine-background-primary-color);"
        >
          <div
            style="width: ${this._daysToShow *
            this._dayWidth}px; position: relative;"
          >
            <!-- Header Dates -->
            <div
              style="display: flex; height: 40px; border-bottom: 2px solid var(--affine-border-color);"
            >
              ${days.map(
                date => html`
                  <div
                    style="width: ${this
                      ._dayWidth}px; flex-shrink: 0; text-align: center; border-right: 1px solid var(--affine-border-color); font-size: 10px; padding-top: 4px;"
                  >
                    ${date.toLocaleDateString('default', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                `
              )}
            </div>

            <!-- Row Bars -->
            <div class="timeline-body" style="position: relative;">
              ${repeat(
                this.view.rows$.value,
                row => row.rowId,
                (row, index) => this._renderRowBar(row, index, titleColumnId)
              )}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderRowBar(row: any, index: number, titleColumnId?: string) {
    const startProp = this.view.startPropertyId$.value;
    const endProp = this.view.endPropertyId$.value;

    const startVal = startProp
      ? (this.view.cellGetOrCreate(row.rowId, startProp).value$.value as any)
          ?.value
      : undefined;
    if (!startVal)
      return html`<div
        style="height: 40px; border-bottom: 1px solid var(--affine-border-color);"
      ></div>`;

    const startDate = new Date(startVal);
    const endVal = endProp
      ? (this.view.cellGetOrCreate(row.rowId, endProp).value$.value as any)
          ?.value
      : startVal;
    const endDate = new Date(endVal || startVal);

    const startOffset = Math.max(
      0,
      (startDate.getTime() - this._startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const duration = Math.max(
      1,
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1
    );

    const left = startOffset * this._dayWidth;
    const width = duration * this._dayWidth;

    const title = titleColumnId
      ? this.view.cellGetOrCreate(row.rowId, titleColumnId).stringValue$.value
      : 'Untitled';

    return html`
      <div
        style="height: 40px; position: relative; border-bottom: 1px solid var(--affine-border-color);"
      >
        <div
          style="position: absolute; left: ${left}px; width: ${width}px; height: 24px; top: 8px; background: var(--affine-primary-color); border-radius: 4px; color: white; display: flex; align-items: center; padding: 0 8px; font-size: 11px; white-space: nowrap; overflow: hidden;"
        >
          ${title || 'Untitled'}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-view': TimelineView;
  }
}
