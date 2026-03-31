import type {
  DatabaseBlockModel,
  LinkedDatabaseBlockModel,
} from '@blocksuite/affine-model';
import type { InsertToPosition } from '@blocksuite/affine-shared/utils';
import type {
  DatabaseFlags,
  DataViewDataType,
  PropertyMetaConfig,
  TypeInstance,
  ViewConvertConfig,
  ViewManager,
  ViewMeta,
} from '@blocksuite/data-view';
import { DataSourceBase, ViewManagerBase } from '@blocksuite/data-view';
import { viewConverts, viewPresets } from '@blocksuite/data-view/view-presets';
import type { ServiceProvider } from '@blocksuite/global/di';
import { BlockSuiteError, ErrorCode } from '@blocksuite/global/exceptions';
import type { ReadonlySignal } from '@preact/signals-core';
import { computed } from '@preact/signals-core';

import { DatabaseBlockDataSource } from '../../database/src/data-source.js';
import {
  databaseBlockViewMap,
  databaseBlockViews,
} from '../../database/src/views/index.js';

/**
 * A thin proxy DataSource for `affine:linked-database` blocks.
 *
 * Delegates ALL row/cell/property operations to an inner
 * `DatabaseBlockDataSource` derived from the source database model.
 * Owns view configuration locally and persists it to the linked-database
 * block's `views[]` prop.
 *
 * NOTE: Same-doc only for Phase 4. Cross-doc linking is a future TODO.
 */
export class LinkedDatabaseBlockDataSource extends DataSourceBase {
  // Eagerly initialized before field references below use them.
  private readonly _source: DatabaseBlockDataSource;
  private readonly _viewManager: ViewManagerBase;

  constructor(
    private readonly _linkedModel: LinkedDatabaseBlockModel,
    sourceModel: DatabaseBlockModel
  ) {
    super();
    this._source = new DatabaseBlockDataSource(sourceModel);
    this._viewManager = new ViewManagerBase(this);

    // Ensure the linked block always has at least one view.
    if (this._linkedModel.props.views.length === 0) {
      const defaultId = Math.random().toString(36).slice(2);
      this._linkedModel.store.transact(() => {
        this._linkedModel.props.views.push({
          id: defaultId,
          name: 'Table View',
          mode: viewPresets.tableViewMeta.type,
          filter: { conditions: [] },
          sort: { manuallySort: [], sortBy: [] },
          groupBy: undefined,
          header: { titleColumn: '', iconColumn: '' },
          columnOrder: [],
          columns: [],
        } as DataViewDataType);
      });
    }
  }

  // ---- Service provider ----
  override get parentProvider(): ServiceProvider {
    return this._source.parentProvider;
  }

  // ---- Read-only delegates (defined in constructor so fields exist first) ----
  override get featureFlags$(): ReadonlySignal<DatabaseFlags> {
    return this._source.featureFlags$;
  }

  override get readonly$(): ReadonlySignal<boolean> {
    return this._source.readonly$;
  }

  override get properties$(): ReadonlySignal<string[]> {
    return this._source.properties$;
  }

  override get propertyMetas$(): ReadonlySignal<PropertyMetaConfig[]> {
    return this._source.propertyMetas$;
  }

  override get allPropertyMetas$(): ReadonlySignal<PropertyMetaConfig[]> {
    return this._source.allPropertyMetas$;
  }

  // ---- Property ops (delegate) ----
  override propertyMetaGet(type: string): PropertyMetaConfig | undefined {
    return this._source.propertyMetaGet(type);
  }

  override propertyNameGet(propertyId: string): string {
    return this._source.propertyNameGet(propertyId);
  }

  override propertyNameSet(propertyId: string, name: string): void {
    this._source.propertyNameSet(propertyId, name);
  }

  override propertyTypeGet(propertyId: string): string | undefined {
    return this._source.propertyTypeGet(propertyId);
  }

  override propertyTypeSet(propertyId: string, type: string): void {
    this._source.propertyTypeSet(propertyId, type);
  }

  override propertyDataGet(propertyId: string): Record<string, unknown> {
    return this._source.propertyDataGet(propertyId);
  }

  override propertyDataSet(
    propertyId: string,
    data: Record<string, unknown>
  ): void {
    this._source.propertyDataSet(propertyId, data);
  }

  override propertyDataTypeGet(propertyId: string): TypeInstance | undefined {
    return this._source.propertyDataTypeGet(propertyId);
  }

  override propertyAdd(
    insertToPosition: InsertToPosition,
    ops?: { type?: string; name?: string }
  ): string | undefined {
    return this._source.propertyAdd(insertToPosition, ops);
  }

  override propertyDuplicate(propertyId: string): string | undefined {
    return this._source.propertyDuplicate(propertyId);
  }

  override propertyDelete(id: string): void {
    this._source.propertyDelete(id);
  }

  protected override getNormalPropertyAndIndex(propertyId: string) {
    return (this._source as any).getNormalPropertyAndIndex(propertyId);
  }

  // ---- Row ops (delegate) ----
  override get rows$(): ReadonlySignal<string[]> {
    return this._source.rows$;
  }

  override rowAdd(insertToPosition: InsertToPosition | number): string {
    return this._source.rowAdd(insertToPosition);
  }

  override rowDelete(ids: string[]): void {
    this._source.rowDelete(ids);
  }

  override rowMove(rowId: string, position: InsertToPosition): void {
    this._source.rowMove(rowId, position);
  }

  // ---- Cell ops (delegate) ----
  override cellValueGet(rowId: string, propertyId: string): unknown {
    return this._source.cellValueGet(rowId, propertyId);
  }

  override cellValueChange(
    rowId: string,
    propertyId: string,
    value: unknown
  ): void {
    this._source.cellValueChange(rowId, propertyId, value);
  }

  // ---- View management (LOCAL — persisted to linked-db block props) ----
  override viewConverts: ViewConvertConfig[] = [...viewConverts];
  override viewMetas: ViewMeta[] = [...databaseBlockViews];

  override get viewDataList$(): ReadonlySignal<DataViewDataType[]> {
    return computed(() => this._linkedModel.props.views as DataViewDataType[]);
  }

  override get viewManager(): ViewManager {
    return this._viewManager;
  }

  override viewDataGet(viewId: string): DataViewDataType | undefined {
    return this._linkedModel.props.views.find(v => v.id === viewId) as
      | DataViewDataType
      | undefined;
  }

  override viewDataAdd(viewData: DataViewDataType): string {
    this._linkedModel.store.transact(() => {
      this._linkedModel.props.views.push(viewData as any);
    });
    return viewData.id;
  }

  override viewDataDuplicate(id: string): string {
    const view = this.viewDataGet(id);
    if (!view) {
      throw new BlockSuiteError(
        ErrorCode.DatabaseBlockError,
        `View ${id} not found`
      );
    }
    const newId = Math.random().toString(36).slice(2);
    const duplicate = { ...view, id: newId, name: `${view.name} Copy` };
    return this.viewDataAdd(duplicate as DataViewDataType);
  }

  override viewDataDelete(viewId: string): void {
    this._linkedModel.store.transact(() => {
      const idx = this._linkedModel.props.views.findIndex(v => v.id === viewId);
      if (idx !== -1) {
        this._linkedModel.props.views.splice(idx, 1);
      }
    });
  }

  override viewDataMoveTo(id: string, position: InsertToPosition): void {
    const views = this._linkedModel.props.views;
    const current = views.findIndex(v => v.id === id);
    if (current === -1) return;
    const view = views[current]!;
    this._linkedModel.store.transact(() => {
      views.splice(current, 1);
      let target: number;
      if (position === 'start') {
        target = 0;
      } else if (position === 'end') {
        target = views.length;
      } else {
        // { id, before }
        const refIdx = views.findIndex(v => v.id === position.id);
        target =
          refIdx === -1 ? views.length : refIdx + (position.before ? 0 : 1);
      }
      views.splice(Math.max(0, target), 0, view);
    });
  }

  override viewDataUpdate<ViewData extends DataViewDataType>(
    id: string,
    updater: (data: ViewData) => Partial<ViewData>
  ): void {
    this._linkedModel.store.transact(() => {
      this._linkedModel.props.views = this._linkedModel.props.views.map(v => {
        if (v.id !== id) {
          return v;
        }
        return { ...v, ...updater(v as ViewData) };
      });
    });
  }

  override viewMetaGet(type: string): ViewMeta {
    const view = databaseBlockViewMap[type];
    if (!view) {
      // Defensive fallback: unknown view mode from a newer client.
      console.warn(
        `[AFFiNE] LinkedDatabase: unknown view type "${type}". Falling back to default view.`
      );
      return databaseBlockViews[0]!;
    }
    return view;
  }

  override viewMetaGetById(viewId: string): ViewMeta | undefined {
    const view = this.viewDataGet(viewId);
    if (!view) return undefined;
    if (!databaseBlockViewMap[view.mode]) return undefined;
    return this.viewMetaGet(view.mode);
  }

  /** Reactive source database title for the linked-view header. */
  get sourceTitle$(): ReadonlySignal<string> {
    return computed(() => {
      const model = (this._source as any)['_model'] as
        | DatabaseBlockModel
        | undefined;
      const title = model?.props.title;
      if (!title) return 'Untitled';
      // Accessing deltas$.value makes this computed reactive to text changes.
      void title.deltas$.value;
      return title.toString();
    });
  }
}
