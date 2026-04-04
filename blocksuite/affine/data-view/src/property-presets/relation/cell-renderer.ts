import '@blocksuite/affine-components/toggle-switch';

import {
  menu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
  renderSubMenu,
  subMenuMiddleware,
} from '@blocksuite/affine-components/context-menu';
import {
  CrossTeamspaceRelationHostService,
  FeatureFlagService,
  type ResolvedRelationRow,
} from '@blocksuite/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Store } from '@blocksuite/store';
import { signal } from '@preact/signals-core';
import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { BaseCellRenderer } from '../../core/property/index.js';
import { createFromBaseCellRenderer } from '../../core/property/renderer.js';
import {
  findAllDatabases,
  findAllDatabasesInWorkspace,
  resolveCrossDocPickerStore,
} from '../../core/utils/database-picker.js';
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

/** Cross-workspace relay column UX is active only when the Affine/Blocksuite flag is on and column carries relay metadata. */
export function isCrossWorkspaceRelayColumnUx(
  store: Store,
  data: {
    crossWorkspaceRelayReadOnly?: boolean;
    crossWorkspaceTargetWorkspaceId?: string;
  }
): boolean {
  if (
    !store.get(FeatureFlagService).getFlag('enable_cross_workspace_relation')
  ) {
    return false;
  }
  if (data.crossWorkspaceRelayReadOnly) return true;
  const ws = data.crossWorkspaceTargetWorkspaceId;
  return typeof ws === 'string' && ws.length > 0;
}

/** Relation targets another page in the same workspace (optional `targetDocId`). */
export function isCrossDocRelationStore(
  store: Store,
  data: { targetDocId?: string }
): boolean {
  const t = data.targetDocId;
  return typeof t === 'string' && t.length > 0 && t !== store.id;
}

export function isCrossTeamspaceRelationFlagOn(store: Store): boolean {
  return store
    .get(FeatureFlagService)
    .getFlag('enable_cross_teamspace_relation');
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

/** Label for cross-doc relation chips when server relay is not available (view-only). */
export function viewOnlyCrossDocRelationChipLabel(rowId: string): string {
  if (!rowId) return 'Linked record';
  return rowId.length <= 12 ? rowId : `Linked record (${rowId.slice(0, 8)}…)`;
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
    const dataSource = this.column.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    const data = this.column.data$.value as any;
    if (
      isCrossTeamspaceRelationFlagOn(store) &&
      isCrossDocRelationStore(store, data)
    ) {
      return;
    }
    this.column.dataUpdate(d => ({
      ...d,
      isBidirectional: !d.isBidirectional,
    }));
  }

  private cleanUpOrphanedRelations(e: MouseEvent) {
    e.stopPropagation();
    const dataSource = this.column.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    const data = this.column.data$.value as any;
    if (
      isCrossTeamspaceRelationFlagOn(store) &&
      isCrossDocRelationStore(store, data)
    ) {
      return;
    }
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
    const data = this.column.data$.value as any;
    if (
      isCrossTeamspaceRelationFlagOn(store) &&
      isCrossDocRelationStore(store, data)
    ) {
      return;
    }
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
    if (isCrossWorkspaceRelayColumnUx(store, data)) {
      return html`
        <div
          style="font-size: 12px; color: var(--affine-text-secondary-color); padding: 8px;"
        >
          View-only relation column (cross-workspace relay). Column settings are
          locked.
        </div>
      `;
    }
    const crossTeamspaceFlagOn = isCrossTeamspaceRelationFlagOn(store);
    const databases = crossTeamspaceFlagOn
      ? findAllDatabasesInWorkspace(store)
      : findAllDatabases(store);
    const targetDatabase = data.targetDatabaseId
      ? store.getBlock(data.targetDatabaseId)?.model
      : null;
    const targetDbFromList = databases.find(
      d =>
        d.id === data.targetDatabaseId &&
        (d.sourceDocId ?? store.id) === (data.targetDocId ?? store.id)
    );
    const targetDatabaseName =
      (targetDatabase as any)?.props?.title?.toString() ||
      targetDbFromList?.title ||
      'Select database';

    return html`
      <div
        style="display: flex; flex-direction: column; gap: 4px; padding: 4px;"
      >
        ${!crossTeamspaceFlagOn
          ? html`<div
              style="font-size: 11px; color: var(--affine-text-secondary-color); padding: 0 8px 4px; line-height: 1.4;"
            >
              Turn on
              <strong>Cross-teamspace database relations</strong>
              in workspace Settings → Experimental features to link a table on
              another page (same cloud workspace).
            </div>`
          : html`<div
              style="font-size: 11px; color: var(--affine-text-secondary-color); padding: 0 8px 4px; line-height: 1.4;"
            >
              Databases on other pages are labeled with their doc title. Cloud
              sync and access on both pages are required for linking and
              editing.
            </div>`}
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
                        isSelected:
                          db.id === data.targetDatabaseId &&
                          (db.sourceDocId ?? store.id) ===
                            (data.targetDocId ?? store.id),
                        select: () => {
                          const cross =
                            crossTeamspaceFlagOn &&
                            !!db.sourceDocId &&
                            db.sourceDocId !== store.id;
                          this.column.dataUpdate(d => ({
                            ...d,
                            targetDatabaseId: db.id,
                            targetDocId: cross ? db.sourceDocId : undefined,
                            isBidirectional: cross ? false : d.isBidirectional,
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
          style="display: flex; align-items: center; justify-content: space-between; padding: 8px; border-radius: 4px; cursor: ${crossTeamspaceFlagOn &&
          isCrossDocRelationStore(store, data)
            ? 'default'
            : 'pointer'}; opacity: ${crossTeamspaceFlagOn &&
          isCrossDocRelationStore(store, data)
            ? '0.5'
            : '1'};"
          @click="${this.toggleBidirectional}"
        >
          <div style="font-size: 14px;">Separate back-reference</div>
          <toggle-switch
            .on="${!data.isBidirectional}"
            .onChange="${() =>
              this.toggleBidirectional(new MouseEvent('click'))}"
          ></toggle-switch>
        </div>
        ${crossTeamspaceFlagOn && isCrossDocRelationStore(store, data)
          ? html`<div
              style="font-size: 11px; color: var(--affine-text-secondary-color); padding: 0 8px 4px;"
            >
              Bidirectional relations are not available for cross-page targets.
            </div>`
          : null}
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

        ${!(crossTeamspaceFlagOn && isCrossDocRelationStore(store, data))
          ? html` <div
              class="dv-hover"
              style="display: flex; align-items: center; padding: 8px; border-radius: 4px; cursor: pointer; color: var(--affine-warning-color);"
              @click="${this.cleanUpOrphanedRelations}"
            >
              <div style="font-size: 14px;">Clean up missing records</div>
            </div>`
          : null}
        ${data.isBidirectional &&
        data.reversePropertyId &&
        !(crossTeamspaceFlagOn && isCrossDocRelationStore(store, data))
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
  @state()
  private accessor _remoteCaps: {
    canReadRelay: boolean;
    canMutateRelation: boolean;
  } | null = null;

  @state()
  private accessor _remoteRows: ResolvedRelationRow[] | null = null;

  private _remoteSyncGen = 0;
  private _lastRemoteKey = '';

  override updated(_changed: PropertyValues) {
    super.updated(_changed);
    void this._refreshCrossTeamspaceRemote().catch(() => {
      /* best-effort remote labels */
    });
  }

  private async _refreshCrossTeamspaceRemote() {
    const dataSource = this.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    const propData = this.property.data$.value as {
      targetDatabaseId?: string;
      targetDocId?: string;
    };
    if (
      !isCrossTeamspaceRelationFlagOn(store) ||
      !isCrossDocRelationStore(store, propData)
    ) {
      if (this._remoteCaps !== null || this._remoteRows !== null) {
        this._remoteCaps = null;
        this._remoteRows = null;
        this._lastRemoteKey = '';
      }
      return;
    }
    const host = store.getOptional(CrossTeamspaceRelationHostService);
    if (!host?.isActive()) {
      if (this._remoteCaps !== null || this._remoteRows !== null) {
        this._remoteCaps = null;
        this._remoteRows = null;
        this._lastRemoteKey = '';
      }
      return;
    }
    const tid = propData.targetDocId as string;
    const tdb = propData.targetDatabaseId as string;
    const ids = this.value ?? [];
    const key = `${store.id}|${tid}|${tdb}|${ids.join(',')}`;
    if (key === this._lastRemoteKey && this._remoteRows !== null) {
      return;
    }
    this._lastRemoteKey = key;
    const gen = ++this._remoteSyncGen;
    try {
      const caps = await host.getCapabilities(store.id, tid);
      if (gen !== this._remoteSyncGen) {
        return;
      }
      this._remoteCaps = caps;
      if (!caps.canReadRelay) {
        this._remoteRows = [];
        return;
      }
      if (ids.length === 0) {
        this._remoteRows = [];
        return;
      }
      const rows = await host.resolveRows(store.id, tid, tdb, ids);
      if (gen !== this._remoteSyncGen) {
        return;
      }
      this._remoteRows = rows;
    } catch {
      if (gen === this._remoteSyncGen) {
        this._remoteRows = [];
      }
    }
  }

  override render() {
    const dataSource = this.view.manager.dataSource as any;
    const store = dataSource.doc as Store;
    const propData = this.property.data$.value as {
      targetDatabaseId?: string;
      targetDocId?: string;
      crossWorkspaceRelayReadOnly?: boolean;
      crossWorkspaceTargetWorkspaceId?: string;
    };
    const targetDatabaseId = propData.targetDatabaseId as string;
    const crossWorkspaceRelayUx = isCrossWorkspaceRelayColumnUx(
      store,
      propData
    );
    const crossDocUx =
      isCrossTeamspaceRelationFlagOn(store) &&
      isCrossDocRelationStore(store, propData);
    const crossTeamspaceRelayUx =
      crossDocUx &&
      this._remoteCaps != null &&
      !this._remoteCaps.canMutateRelation;
    const relayUx = crossWorkspaceRelayUx || crossTeamspaceRelayUx;

    if (!targetDatabaseId) {
      return html`
        <div
          style="padding: 4px; color: var(--affine-text-secondary-color); font-size: 12px; font-style: italic;"
        >
          Target not set
        </div>
      `;
    }

    if (this.isEditing$.value) {
      return html`<div style="padding: 4px; opacity: 0.5;">Picking...</div>`;
    }

    let relationIds = this.value ?? [];

    if (!crossDocUx) {
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
          this.valueSetNextTick(filtered);
          relationIds = filtered;
        }
      }
    } else if (this._remoteRows !== null && this._remoteCaps?.canReadRelay) {
      const validIds = new Set(
        this._remoteRows.filter(r => r.exists).map(r => r.rowId)
      );
      const filtered = filterRelationIdsByValidSet(relationIds, validIds);
      const isSame =
        filtered.length === relationIds.length &&
        filtered.every((id, idx) => id === relationIds[idx]);
      if (!isSame) {
        this.valueSetNextTick(filtered);
        relationIds = filtered;
      }
    }

    return html`
      <div style="display: flex; gap: 4px; flex-wrap: wrap; padding: 4px 0;">
        ${relayUx
          ? html`<span
              style="font-size: 10px; color: var(--affine-text-secondary-color); width: 100%;"
              >${crossWorkspaceRelayUx
                ? 'View only'
                : 'View only — enable experimental cross-teamspace relations (workspace Settings) or ensure access on both pages'}</span
            >`
          : null}
        ${relationIds.length === 0
          ? html`<span style="color: var(--affine-placeholder-color);"
              >Empty</span
            >`
          : repeat(
              relationIds,
              id => id,
              id => {
                const remote = this._remoteRows?.find(r => r.rowId === id);
                let label: string;
                if (crossDocUx) {
                  if (this._remoteCaps && !this._remoteCaps.canReadRelay) {
                    label = viewOnlyCrossDocRelationChipLabel(id as string);
                  } else if (this._remoteRows === null) {
                    label = '…';
                  } else if (remote) {
                    label = remote.title;
                  } else {
                    label = '…';
                  }
                } else {
                  label = getRowTitle(
                    (this.view.manager.dataSource as any).doc,
                    id as string
                  );
                }
                return html`
                  <div
                    style="padding: 2px 6px; background: var(--affine-background-tertiary-color); border-radius: 4px; font-size: 12px; cursor: ${relayUx
                      ? 'default'
                      : 'pointer'};"
                    @click="${(e: MouseEvent) => {
                      e.stopPropagation();
                      if (relayUx) return;
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
                    ${label}
                  </div>
                `;
              }
            )}
      </div>
    `;
  }

  override afterEnterEditingMode() {
    const store = (this.view.manager.dataSource as any).doc as Store;
    const propData = this.property.data$.value as {
      targetDatabaseId?: string;
      targetDocId?: string;
      crossWorkspaceRelayReadOnly?: boolean;
      crossWorkspaceTargetWorkspaceId?: string;
    };
    if (isCrossWorkspaceRelayColumnUx(store, propData)) {
      this.selectCurrentCell(false);
      return;
    }
    const crossDocUx =
      isCrossTeamspaceRelationFlagOn(store) &&
      isCrossDocRelationStore(store, propData);

    const targetDatabaseId = propData.targetDatabaseId as string;
    if (!targetDatabaseId) {
      this.selectCurrentCell(false);
      return;
    }

    const openPicker = (pickerStore: Store) => {
      popRowSelect(popupTargetFromElement(this), {
        store: pickerStore,
        targetDbId: targetDatabaseId,
        value: this.value ?? [],
        onChange: val => this.valueSetImmediate(val),
        onComplete: () => this.selectCurrentCell(false),
      });
    };

    if (crossDocUx) {
      const host = store.getOptional(CrossTeamspaceRelationHostService);
      if (!host?.isActive()) {
        this.selectCurrentCell(false);
        return;
      }
      const td = propData.targetDocId as string;
      void (async () => {
        const caps = await host.getCapabilities(store.id, td);
        if (!caps.canMutateRelation) {
          this.selectCurrentCell(false);
          return;
        }
        const pickerStore =
          td.length > 0 && td !== store.id
            ? await resolveCrossDocPickerStore(
                store.workspace,
                td,
                targetDatabaseId
              )
            : store;
        if (!pickerStore) {
          this.selectCurrentCell(false);
          return;
        }
        openPicker(pickerStore);
      })().catch(() => {
        this.selectCurrentCell(false);
      });
      return;
    }

    openPicker(store);
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
