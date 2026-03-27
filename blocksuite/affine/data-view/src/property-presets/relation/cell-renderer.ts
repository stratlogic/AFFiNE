import '@blocksuite/affine-components/toggle-switch';

import {
  menu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Store } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { BaseCellRenderer } from '../../core/property/index.js';
import { createFromBaseCellRenderer } from '../../core/property/renderer.js';
import { findAllDatabases } from '../../core/utils/database-picker.js';
import { createUniComponentFromWebComponent } from '../../core/utils/uni-component/index.js';
import { createIcon } from '../../core/utils/uni-icon.js';
import type { TableProperty } from '../../view-presets/table/table-view-manager.js';
import { relationPropertyModelConfig } from './define.js';

// Helper to resolve row titles across the workspace
function getRowTitle(store: Store, _targetDbId: string, rowId: string): string {
  const row = store.getBlock(rowId)?.model as any;
  if (!row) return '(deleted)';
  // Database rows are typically blocks with text/title
  return row.title?.toString() || row.text?.toString() || 'Untitled';
}

// Helper to pop the row select menu
function popRowSelect(
  target: PopupTarget,
  options: {
    store: Store;
    targetDbId: string;
    value: string[];
    onChange: (value: string[]) => void;
    onComplete?: () => void;
  }
) {
  const { store, targetDbId, value, onChange, onComplete } = options;
  const targetDb = store.getBlock(targetDbId)?.model;
  if (!targetDb) return;

  const rows = targetDb.children.map(child => ({
    id: child.id,
    title: getRowTitle(store, targetDbId, child.id),
  }));

  const text$ = signal('');

  popMenu(target, {
    options: {
      onClose: onComplete,
      title: { text: 'Select Rows' },
      items: [
        menu.input({
          initialValue: '',
          placeholder: 'Search rows...',
          onChange: val => {
            text$.value = val;
          },
        }),
        menu.group({
          items: [
            menu.dynamic(() => {
              const filter = text$.value.toLowerCase();
              return rows
                .filter(row => row.title.toLowerCase().includes(filter))
                .map(row =>
                  menu.action({
                    name: row.title,
                    isSelected: value.includes(row.id),
                    select: () => {
                      const newValue = value.includes(row.id)
                        ? value.filter(id => id !== row.id)
                        : [...value, row.id];
                      onChange(newValue);
                      return false; // Keep menu open
                    },
                  })
                );
            }),
          ],
        }),
      ],
    },
  });
}

export class RelationSettings extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  @property({ attribute: false })
  accessor column!: TableProperty;

  @property({ attribute: false })
  accessor menu!: any;

  private toggleBidirectional(e: MouseEvent) {
    e.stopPropagation();
    this.column.dataUpdate(data => ({
      ...data,
      isBidirectional: !data.isBidirectional,
    }));
  }

  private popDatabaseSelect(e: MouseEvent) {
    e.stopPropagation();
    const dataSource = this.column.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    if (!store) return;
    const databases = findAllDatabases(store);

    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options: {
        title: { text: 'Select database' },
        items: databases.map(db =>
          menu.action({
            name: db.title || 'Untitled Database',
            isSelected: db.id === this.column.data$.value.targetDatabaseId,
            select: () => {
              this.column.dataUpdate(data => ({
                ...data,
                targetDatabaseId: db.id,
              }));
              this.menu?.close();
            },
          })
        ),
      },
    });
  }

  override render() {
    const data = this.column.data$.value as any;
    const store = (this.column.view.manager.dataSource as any).doc as Store;
    const targetDatabase = data.targetDatabaseId
      ? store.getBlock(data.targetDatabaseId)?.model
      : null;
    const targetDatabaseName =
      (targetDatabase as any)?.props?.title?.toString() || 'Select database';

    return html`
      <div
        style="display: flex; flex-direction: column; gap: 4px; padding: 4px;"
      >
        <div
          class="dv-hover"
          style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; cursor: pointer;"
          @click="${this.popDatabaseSelect}"
        >
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div
              style="font-size: 10px; color: var(--affine-text-secondary-color);"
            >
              Relation to
            </div>
            <div style="font-size: 14px;">${targetDatabaseName}</div>
          </div>
          <uni-lit .uni="${createIcon('ArrowRightSmallIcon')}"></uni-lit>
        </div>

        <div
          class="dv-hover"
          style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; cursor: pointer;"
          @click="${this.toggleBidirectional}"
        >
          <div style="font-size: 14px;">Separate back-reference</div>
          <toggle-switch
            .on="${!data.isBidirectional}"
            .onChange="${() => this.toggleBidirectional()}"
          ></toggle-switch>
        </div>
      </div>
    `;
  }
}

const RelationSettingsUni = createUniComponentFromWebComponent<{
  column: TableProperty;
}>(RelationSettings);

export class RelationCell extends BaseCellRenderer<string[]> {
  // We don't have CSS variables yet, so using inline styles for now

  override render() {
    const targetDatabaseId = this.property.data$.value
      .targetDatabaseId as string;

    if (!targetDatabaseId) {
      return html`
        <div
          style="padding: 4px; color: var(--affine-text-secondary-color); font-size: 12px; font-style: italic;"
        >
          Target not set
        </div>
      `;
    }

    // Editing logic is handled via popRowSelect in afterEnterEditingMode
    if (this.isEditing$.value) {
      return html`<div style="padding: 4px; opacity: 0.5;">Picking...</div>`;
    }

    // Read mode
    return html`
      <div style="display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0;">
        ${(this.value ?? []).length === 0
          ? html`<span style="color: var(--affine-placeholder-color);"
              >Empty</span
            >`
          : repeat(
              this.value ?? [],
              id => id,
              id => html`
                <div
                  style="padding: 2px 6px; background: var(--affine-background-tertiary-color); border-radius: 4px; font-size: 12px; cursor: pointer;"
                  @click="${(e: Event) => {
                    e.stopPropagation();
                    // TODO: Navigate to block
                  }}"
                >
                  ${getRowTitle(
                    (this.view.manager.dataSource as any).doc,
                    targetDatabaseId,
                    id as string
                  )}
                </div>
              `
            )}
      </div>
    `;
  }

  override afterEnterEditingMode() {
    const targetDatabaseId = this.property.data$.value
      .targetDatabaseId as string;
    if (!targetDatabaseId) {
      this.selectCurrentCell(false);
      return;
    }

    popRowSelect(popupTargetFromElement(this), {
      store: (this.view.manager.dataSource as any).doc,
      targetDbId: targetDatabaseId,
      value: this.value ?? [],
      onChange: val => this.valueSetImmediate(val),
      onComplete: () => this.selectCurrentCell(false),
    });
  }
}

export const relationPropertyConfig =
  relationPropertyModelConfig.createPropertyMeta({
    icon: createIcon('LinkIcon'),
    cellRenderer: {
      view: createFromBaseCellRenderer(RelationCell),
    },
    settings: RelationSettingsUni,
  });
