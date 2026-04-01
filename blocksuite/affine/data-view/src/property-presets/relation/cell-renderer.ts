import '@blocksuite/affine-components/toggle-switch';

import {
  menu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
  renderSubMenu,
  subMenuMiddleware,
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

type LinkedReference = {
  pageId: string;
  title?: string;
};

function getLinkedReferenceFromText(
  text: any | undefined
): LinkedReference | null {
  const deltas = text?.deltas$?.value as any[] | undefined;
  if (!deltas || deltas.length === 0) return null;
  for (const delta of deltas) {
    const reference = delta?.attributes?.reference;
    if (
      reference?.type === 'LinkedPage' &&
      typeof reference.pageId === 'string'
    ) {
      return {
        pageId: reference.pageId,
        title:
          typeof reference.title === 'string' && reference.title.trim() !== ''
            ? reference.title
            : undefined,
      };
    }
  }
  return null;
}

function getLinkedReferenceTitle(
  store: Store,
  text: any | undefined
): string | null {
  const reference = getLinkedReferenceFromText(text);
  if (!reference) return null;
  if (reference.title) return reference.title;
  const metaTitle = store.workspace.meta.docMetas.find(
    meta => meta.id === reference.pageId
  )?.title;
  return metaTitle ?? null;
}

export function getRowLinkedPageTarget(
  store: Store,
  rowId: string
): string | null {
  const row = store.getBlock(rowId)?.model as any;
  if (!row) return null;
  const titleText = row.title as any | undefined;
  const text = row.text as any | undefined;
  return (
    getLinkedReferenceFromText(titleText)?.pageId ??
    getLinkedReferenceFromText(text)?.pageId ??
    null
  );
}

// Helper to resolve row titles across the workspace
export function getRowTitle(store: Store, rowId: string): string {
  const row = store.getBlock(rowId)?.model as any;
  if (!row) return '(deleted)';
  // Database rows are typically blocks with text/title

  // `Text.toString()` returns a snapshot and does not inherently trigger
  // SignalWatcher re-renders. Touch the reactive signal here so relation
  // chips update when the referenced row title changes.
  const titleText = row.title as any | undefined;
  const text = row.text as any | undefined;

  void titleText?.deltas$?.value;
  void text?.deltas$?.value;

  const linkedTitle =
    getLinkedReferenceTitle(store, titleText) ??
    getLinkedReferenceTitle(store, text);
  if (linkedTitle) return linkedTitle;

  const raw = titleText?.toString?.() || text?.toString?.() || '';
  return raw === '' ? 'Untitled' : raw;
}

export function filterRelationIdsByValidSet(
  ids: readonly string[] | null | undefined,
  validIds: ReadonlySet<string>
): string[] {
  if (!ids?.length) return [];
  return ids.filter(id => validIds.has(id));
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
    title: getRowTitle(store, child.id),
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

  private readonly _dbSearch$ = signal('');

  private toggleBidirectional(e: MouseEvent) {
    e.stopPropagation();
    this.column.dataUpdate(data => ({
      ...data,
      isBidirectional: !data.isBidirectional,
    }));
  }

  private cleanUpOrphanedRelations(e: MouseEvent) {
    e.stopPropagation();
    const dataSource = this.column.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    const data = this.column.data$.value as any;
    const rows = dataSource.rows$.value as string[];
    const propertyId = this.column.id;
    const targetDatabaseId = data?.targetDatabaseId as string | undefined;

    const targetDb = targetDatabaseId
      ? store.getBlock(targetDatabaseId)?.model
      : null;
    const validIds = targetDb?.children
      ? new Set<string>(targetDb.children.map((c: any) => c.id))
      : null;

    store.transact(() => {
      rows.forEach(rowId => {
        const value = dataSource.cellValueGet(rowId, propertyId) as
          | string[]
          | undefined;
        if (!value || value.length === 0) return;

        const filtered = value.filter(targetId => {
          if (!store.getBlock(targetId)) return false;
          if (!validIds) return true;
          return validIds.has(targetId);
        });
        if (filtered.length !== value.length) {
          dataSource.cellValueChange(rowId, propertyId, filtered);
        }
      });
    });
    this.menu?.close();
  }

  private healBidirectionalRelations(e: MouseEvent) {
    e.stopPropagation();
    const dataSource = this.column.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    const rows = dataSource.rows$.value as string[];
    const propertyId = this.column.id;

    store.transact(() => {
      rows.forEach(rowId => {
        const value = dataSource.cellValueGet(rowId, propertyId) as
          | string[]
          | undefined;
        if (value && value.length > 0) {
          // Force a re-sync of bidirectional relations by simulating a clear and restore
          dataSource.cellValueChange(rowId, propertyId, []);
          dataSource.cellValueChange(rowId, propertyId, value);
        }
      });
    });
    this.menu?.close();
  }

  private renderSubMenuRow(
    label: string,
    value: string,
    title: string,
    items: any[]
  ) {
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
    const store = (this.column.view.manager.dataSource as any).doc as Store;
    const databases = findAllDatabases(store);
    const targetDatabase = data.targetDatabaseId
      ? store.getBlock(data.targetDatabaseId)?.model
      : null;
    const targetDatabaseName =
      (targetDatabase as any)?.props?.title?.toString() || 'Select database';

    return html`
      <div
        style="display: flex; flex-direction: column; gap: 4px; padding: 4px;"
      >
        ${this.renderSubMenuRow(
          'Relation to',
          targetDatabaseName,
          'Select database',
          [
            menu.input({
              initialValue: '',
              placeholder: 'Search databases...',
              onChange: val => {
                this._dbSearch$.value = val;
              },
            }),
            menu.group({
              items: [
                menu.dynamic(() => {
                  const filter = this._dbSearch$.value.toLowerCase();
                  return databases
                    .filter(db =>
                      (db.title || 'Untitled Database')
                        .toLowerCase()
                        .includes(filter)
                    )
                    .map(db =>
                      menu.action({
                        name: db.title || 'Untitled Database',
                        info: db.docTitle
                          ? html`<span
                              style="color: var(--affine-text-secondary-color); font-size: 12px; margin-left: 8px;"
                              >(${db.docTitle})</span
                            >`
                          : undefined,
                        isSelected: db.id === data.targetDatabaseId,
                        select: () => {
                          this.column.dataUpdate(data => ({
                            ...data,
                            targetDatabaseId: db.id,
                          }));
                          this.menu?.close();
                        },
                      })
                    );
                }),
              ],
            }),
          ]
        )}

        <div
          class="dv-hover"
          style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; cursor: pointer;"
          @click="${this.toggleBidirectional}"
        >
          <div style="font-size: 14px;">Separate back-reference</div>
          <toggle-switch
            .on="${!data.isBidirectional}"
            .onChange="${() =>
              this.toggleBidirectional(new MouseEvent('click'))}"
          ></toggle-switch>
        </div>
        ${(
          this.column.view.manager.dataSource as {
            isBlockQueryDataSource?: boolean;
          }
        ).isBlockQueryDataSource
          ? html`<div
              style="font-size: 11px; color: var(--affine-text-secondary-color); padding: 0 8px 4px;"
            >
              Query row ids are block ids; cells persist if a row leaves the
              query.
            </div>`
          : null}

        <div
          style="height: 1px; background: var(--affine-border-color); margin: 4px 0;"
        ></div>

        <div
          class="dv-hover"
          style="display: flex; align-items: center; padding: 8px; border-radius: 4px; cursor: pointer; color: var(--affine-warning-color);"
          @click="${this.cleanUpOrphanedRelations}"
        >
          <div style="font-size: 14px;">Clean up missing records</div>
        </div>

        ${data.isBidirectional && data.reversePropertyId
          ? html`
              <div
                class="dv-hover"
                style="display: flex; align-items: center; padding: 8px; border-radius: 4px; cursor: pointer; color: var(--affine-primary-color);"
                @click="${this.healBidirectionalRelations}"
              >
                <div style="font-size: 14px;">Heal bidirectional links</div>
              </div>
            `
          : null}
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

    // Read mode: auto-remove deleted/orphan relation IDs so chips don't
    // keep showing stale titles.
    const dataSource = this.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    let relationIds = this.value ?? [];

    const targetDb = store.getBlock(targetDatabaseId)?.model as any;
    const validIds = targetDb?.children
      ? new Set<string>(targetDb.children.map((c: any) => c.id))
      : null;
    if (validIds) {
      const filtered = filterRelationIdsByValidSet(relationIds, validIds);
      const isSame =
        filtered.length === relationIds.length &&
        filtered.every((id, idx) => id === relationIds[idx]);
      if (!isSame) {
        // Update after render to avoid render/update cycles.
        this.valueSetNextTick(filtered);
        relationIds = filtered;
      }
    }

    // Read mode
    return html`
      <div style="display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0;">
        ${relationIds.length === 0
          ? html`<span style="color: var(--affine-placeholder-color);"
              >Empty</span
            >`
          : repeat(
              relationIds,
              id => id,
              id => html`
                <div
                  style="padding: 2px 6px; background: var(--affine-background-tertiary-color); border-radius: 4px; font-size: 12px; cursor: pointer;"
                  @click="${(e: MouseEvent) => {
                    e.stopPropagation();
                    this.dispatchEvent(
                      new CustomEvent('affine-database-row-peek-request', {
                        detail: {
                          databaseId: targetDatabaseId,
                          rowId: id as string,
                        },
                        bubbles: true,
                        composed: true,
                      })
                    );
                  }}"
                >
                  ${getRowTitle(
                    (this.view.manager.dataSource as any).doc,
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
