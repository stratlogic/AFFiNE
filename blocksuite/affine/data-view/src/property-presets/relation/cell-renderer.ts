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

import { renderUniLit } from '../../core/index.js';
import { BaseCellRenderer } from '../../core/property/index.js';
import { createFromBaseCellRenderer } from '../../core/property/renderer.js';
import { createUniComponentFromWebComponent } from '../../core/utils/uni-component/index.js';
import { createIcon } from '../../core/utils/uni-icon.js';
import type { TableProperty } from '../../view-presets/table/table-view-manager.js';
import { relationPropertyModelConfig } from './define.js';

// Helper to resolve all databases in the workspace
function findAllDatabases(store: Store): { id: string; title: string }[] {
  const result: { id: string; title: string }[] = [];
  const databases = store.getBlocksByFlavour('affine:database');
  databases.forEach(block => {
    const model = block.model as any;
    result.push({
      id: block.id,
      title: model.title?.toString() || 'Untitled Database',
    });
  });
  return result;
}

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

  override render() {
    const store = (this.column.view.manager.dataSource as any).doc as Store;
    const databases = findAllDatabases(store);
    const currentTargetId = this.column.data$.value.targetDatabaseId as string;

    return menu.subMenu({
      name: 'Related Database',
      prefix: renderUniLit(createIcon('SearchIcon')),
      options: {
        title: { text: 'Select a database' },
        items: databases.map(db =>
          menu.action({
            name: db.title,
            isSelected: db.id === currentTargetId,
            select: () => {
              this.column.dataUpdate(data => ({
                ...data,
                targetDatabaseId: db.id,
              }));
              // Also update name if it matches the default
              if (this.column.name$.value === 'Relation') {
                this.column.nameSet(db.title);
              }
            },
          })
        ) as any,
      },
    });
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
