import { getMonthMatrix } from '@blocksuite/affine-components/date-picker';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type { CalendarSingleView } from '../calendar-view-manager.js';

export class CalendarView extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  @property({ attribute: false })
  accessor view!: CalendarSingleView;

  private _currentDate = new Date();

  override render() {
    const datePropertyId = this.view.datePropertyId$.value;
    if (!datePropertyId) {
      return html`<div style="padding: 20px; text-align: center;">
        Please select a date property in view settings.
      </div>`;
    }

    const matrix = getMonthMatrix(this._currentDate);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return html`
      <div
        class="affine-calendar-view"
        style="display: flex; flex-direction: column; height: 100%;"
      >
        <div
          class="calendar-header"
          style="display: flex; justify-content: space-between; padding: 8px;"
        >
          <div class="current-month">
            ${this._currentDate.toLocaleString('default', {
              month: 'long',
              year: 'numeric',
            })}
          </div>
          <div class="nav-buttons">
            <button @click="${() => this._prevMonth()}">Prev</button>
            <button @click="${() => this._nextMonth()}">Next</button>
          </div>
        </div>
        <div
          class="calendar-grid"
          style="display: grid; grid-template-columns: repeat(7, 1fr); border-top: 1px solid var(--affine-border-color);"
        >
          ${dayNames.map(
            name =>
              html`<div
                style="padding: 8px; text-align: center; font-weight: bold; border-bottom: 1px solid var(--affine-border-color);"
              >
                ${name}
              </div>`
          )}
          ${matrix.flat().map((date: Date) => this._renderDay(date))}
        </div>
      </div>
    `;
  }

  private _renderDay(date: Date) {
    const isToday = date.toDateString() === new Date().toDateString();
    const isCurrentMonth = date.getMonth() === this._currentDate.getMonth();

    // Find rows for this day
    const rows = this.view.rows$.value.filter(row => {
      const datePropId = this.view.datePropertyId$.value;
      if (!datePropId) return false;
      const cell = this.view.cellGetOrCreate(row.rowId, datePropId);
      const val = cell.value$.value as any;
      if (!val || !val.value) return false;
      const rowDate = new Date(val.value);
      return rowDate.toDateString() === date.toDateString();
    });

    const titleColumnId = this.view.mainProperties$.value.titleColumn;

    return html`
      <div
        style="min-height: 100px; border-right: 1px solid var(--affine-border-color); border-bottom: 1px solid var(--affine-border-color); padding: 4px; ${isCurrentMonth
          ? ''
          : 'opacity: 0.4;'}"
      >
        <div
          style="text-align: right; ${isToday
            ? 'color: var(--affine-primary-color); font-weight: bold;'
            : ''}"
        >
          ${date.getDate()}
        </div>
        <div class="day-content">
          ${repeat(
            rows,
            row => row.rowId,
            row => {
              const title = titleColumnId
                ? this.view.cellGetOrCreate(row.rowId, titleColumnId)
                    .stringValue$.value
                : 'Untitled';
              return html`
                <div
                  style="margin-top: 2px; padding: 2px 4px; background: var(--affine-background-tertiary-color); border-radius: 4px; font-size: 11px; cursor: pointer;"
                >
                  ${title || 'Untitled'}
                </div>
              `;
            }
          )}
        </div>
      </div>
    `;
  }

  private _prevMonth() {
    this._currentDate = new Date(
      this._currentDate.getFullYear(),
      this._currentDate.getMonth() - 1,
      1
    );
    this.requestUpdate();
  }

  private _nextMonth() {
    this._currentDate = new Date(
      this._currentDate.getFullYear(),
      this._currentDate.getMonth() + 1,
      1
    );
    this.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-view': CalendarView;
  }
}
