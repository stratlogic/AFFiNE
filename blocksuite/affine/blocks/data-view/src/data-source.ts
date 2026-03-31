import {
  addProperty,
  DatabaseBlockDataSource,
  databasePropertyConverts,
  deleteColumn,
  getCell,
} from '@blocksuite/affine-block-database';
import {
  getRelationIdsFromContainer,
  setRelationIdsOnContainer,
  updateColumnRelationData,
} from '@blocksuite/affine-block-database/utils/relation-container-cells';
import type {
  ColumnDataType,
  DatabaseBlockModel,
} from '@blocksuite/affine-model';
import { FeatureFlagService } from '@blocksuite/affine-shared/services';
import {
  insertPositionToIndex,
  type InsertToPosition,
} from '@blocksuite/affine-shared/utils';
import {
  type DatabaseFlags,
  DataSourceBase,
  type DataViewDataType,
  type PropertyMetaConfig,
  type TypeInstance,
  type ViewConvertConfig,
  type ViewManager,
  ViewManagerBase,
  type ViewMeta,
} from '@blocksuite/data-view';
import { propertyPresets } from '@blocksuite/data-view/property-presets';
import { viewConverts } from '@blocksuite/data-view/view-presets';
import type { ServiceProvider } from '@blocksuite/global/di';
import { IS_MOBILE } from '@blocksuite/global/env';
import { BlockSuiteError } from '@blocksuite/global/exceptions';
import type { EditorHost } from '@blocksuite/std';
import type { Block, BlockModel, Store } from '@blocksuite/store';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import { Subject } from 'rxjs';

import type { BlockMeta } from './block-meta/base.js';
import { blockMetaMap } from './block-meta/index.js';
import { queryBlockAllColumnMap, queryBlockColumns } from './columns/index.js';
import type { DataViewBlockModel } from './data-view-model.js';
import { blockQueryViewMap, blockQueryViews } from './views/index.js';

type RollupPropertyData = {
  relationPropertyId?: string;
  targetPropertyId?: string;
  calculation?: string;
};

export type BlockQueryDataSourceConfig = {
  type: keyof typeof blockMetaMap;
};

export class BlockQueryDataSource extends DataSourceBase {
  readonly isBlockQueryDataSource = true;

  private readonly columnMetaMap = new Map<
    string,
    PropertyMetaConfig<any, any, any>
  >();

  private readonly meta: BlockMeta;

  blockMap = new Map<string, Block>();

  docDisposeMap = new Map<string, () => void>();

  slots = {
    update: new Subject<void>(),
  };

  /** Bumps when any listened doc changes; drives reactive row list and rollup. */
  private readonly _epoch = signal(0);

  override get parentProvider(): ServiceProvider {
    return this.host.store.provider;
  }

  override featureFlags$: ReadonlySignal<DatabaseFlags> = computed(() => {
    const featureFlagService = this.block.store.get(FeatureFlagService);
    const enableTableVirtualScroll = featureFlagService.getFlag(
      'enable_table_virtual_scroll'
    );
    return {
      enable_table_virtual_scroll: enableTableVirtualScroll ?? false,
    };
  });

  override readonly$: ReadonlySignal<boolean> = computed(() => {
    return (
      this.block.store.readonly ||
      (IS_MOBILE &&
        !this.block.store.provider
          .get(FeatureFlagService)
          .getFlag('enable_mobile_database_editing'))
    );
  });

  override allPropertyMetas$: ReadonlySignal<PropertyMetaConfig[]> = computed(
    () => {
      const set = new Set(this.columnMetaMap.keys());
      const extra = (queryBlockColumns as PropertyMetaConfig[]).filter(
        c => !set.has(c.type)
      );
      return [...this.columnMetaMap.values(), ...extra];
    }
  );

  override propertyMetas$: ReadonlySignal<PropertyMetaConfig[]> = computed(() =>
    this.allPropertyMetas$.value.filter(v => !v.config.fixed && !v.config.hide)
  );

  override properties$: ReadonlySignal<string[]> = computed(() => {
    void this._epoch.value;
    const fixed = new Set(this.fixedProperties$.value);
    const out: string[] = [];
    for (const k of this.meta.properties.map(v => v.key)) {
      if (fixed.has(k)) {
        fixed.delete(k);
        out.push(k);
      }
    }
    for (const c of this.block.props.columns) {
      if (fixed.has(c.type)) fixed.delete(c.type);
      out.push(c.id);
    }
    return [...fixed, ...out];
  });

  override rows$: ReadonlySignal<string[]> = computed(() => {
    void this._epoch.value;
    return [...this.blockMap.values()].map(v => v.id);
  });

  override viewConverts: ViewConvertConfig[] = [...viewConverts];

  override viewMetas: ViewMeta[] = [...blockQueryViews];

  override viewDataList$: ReadonlySignal<DataViewDataType[]> = computed(
    () => this.block.props.views as DataViewDataType[]
  );

  override viewManager: ViewManager = new ViewManagerBase(this);

  private get blocks() {
    return [...this.blockMap.values()];
  }

  constructor(
    private readonly host: EditorHost,
    private readonly block: DataViewBlockModel,
    config: BlockQueryDataSourceConfig
  ) {
    super();
    this.meta = blockMetaMap[config.type];
    for (const property of this.meta.properties) {
      this.columnMetaMap.set(property.metaConfig.type, property.metaConfig);
    }
    for (const collection of this.workspace.docs.values()) {
      for (const b of Object.values(collection.getStore().blocks.peek())) {
        if (this.meta.selector(b)) {
          this.blockMap.set(b.id, b);
        }
      }
    }
    this.workspace.docs.forEach(doc => {
      this.listenToDoc(doc.getStore());
    });
    this.workspace.slots.docListUpdated.subscribe(() => {
      this.workspace.docs.forEach(doc => {
        if (!this.docDisposeMap.has(doc.id)) {
          this.listenToDoc(doc.getStore());
        }
      });
      this.docDisposeMap.forEach((_, id) => {
        if (!this.workspace.docs.has(id)) {
          this.docDisposeMap.get(id)?.();
          this.docDisposeMap.delete(id);
        }
      });
    });
    this.slots.update.subscribe(() => {
      this._epoch.value++;
    });
  }

  get doc() {
    return this.block.store;
  }

  get workspace() {
    return this.host.store.workspace;
  }

  protected override getNormalPropertyAndIndex(propertyId: string) {
    const index = this.block.props.columns.findIndex(v => v.id === propertyId);
    if (index < 0) return undefined;
    return { column: this.block.props.columns[index]!, index };
  }

  override cellValueGet$(
    rowId: string,
    propertyId: string
  ): ReadonlySignal<unknown | undefined> {
    return computed(() => {
      void this._epoch.value;
      return this.cellValueGet(rowId, propertyId);
    });
  }

  private syncRelationToReverse(
    rowId: string,
    propertyId: string,
    old: unknown,
    newValue: unknown
  ): void {
    const data = this.propertyDataGet(propertyId) as Record<string, unknown>;
    const reversePropertyId = data?.reversePropertyId as string | undefined;
    const targetDatabaseId = data?.targetDatabaseId as string | undefined;
    if (!reversePropertyId || !targetDatabaseId) return;
    const targetContainer = this.block.store.getBlock(targetDatabaseId)?.model;
    if (!targetContainer) return;

    const oldArray = (Array.isArray(old) ? old : []) as string[];
    const newArray = (Array.isArray(newValue) ? newValue : []) as string[];

    const added = newArray.filter(id => !oldArray.includes(id));
    const removed = oldArray.filter(id => !newArray.includes(id));

    for (const targetRowId of added) {
      const cellVal = getRelationIdsFromContainer(
        targetContainer,
        targetRowId,
        reversePropertyId
      );
      if (!cellVal.includes(rowId)) {
        setRelationIdsOnContainer(
          targetContainer,
          targetRowId,
          reversePropertyId,
          [...cellVal, rowId]
        );
      }
    }
    for (const targetRowId of removed) {
      const cellVal = getRelationIdsFromContainer(
        targetContainer,
        targetRowId,
        reversePropertyId
      );
      if (cellVal.includes(rowId)) {
        setRelationIdsOnContainer(
          targetContainer,
          targetRowId,
          reversePropertyId,
          cellVal.filter((id: string) => id !== rowId)
        );
      }
    }
  }

  cellValueChange(rowId: string, propertyId: string, value: unknown): void {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      const old = this.cellValueGet(rowId, propertyId);
      this.block.store.captureSync();
      this.block.store.transact(() => {
        this.block.props.cells[rowId] = {
          ...this.block.props.cells[rowId],
          [propertyId]: value,
        };
        if (viewColumn.type === 'relation') {
          this.syncRelationToReverse(rowId, propertyId, old, value);
        }
      });
      this.slots.update.next();
      return;
    }
    const b = this.blockMap.get(rowId);
    if (b) {
      this.meta.properties
        .find(v => v.key === propertyId)
        ?.set?.(b.model, value);
      this.slots.update.next();
    }
  }

  cellValueGet(rowId: string, propertyId: string): unknown {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      if (viewColumn.type === 'rollup') {
        return this.computeRollup(rowId, propertyId);
      }
      return this.block.props.cells[rowId]?.[propertyId];
    }
    const b = this.blockMap.get(rowId);
    const metaProp = this.meta.properties.find(v => v.key === propertyId);
    if (b && metaProp) {
      return metaProp.get(b.model);
    }
    return;
  }

  private computeRollup(rowId: string, propertyId: string): unknown {
    const config = this.propertyDataGet(propertyId) as RollupPropertyData;
    if (
      !config.relationPropertyId ||
      !config.targetPropertyId ||
      !config.calculation
    ) {
      return null;
    }

    const relationValue = this.cellValueGet(
      rowId,
      config.relationPropertyId
    ) as string[] | null;
    if (!relationValue || relationValue.length === 0) {
      return this.applyRollupCalculation(config.calculation, []);
    }

    const relationData = this.propertyDataGet(
      config.relationPropertyId
    ) as Record<string, unknown>;
    const targetDatabaseId = relationData?.targetDatabaseId as
      | string
      | undefined;
    if (!targetDatabaseId) {
      return null;
    }

    const targetDb = this.block.store.getBlock(targetDatabaseId)?.model as
      | DatabaseBlockModel
      | undefined;
    if (!targetDb) {
      return null;
    }

    const values = relationValue.map(targetRowId => {
      const cell = getCell(targetDb, targetRowId, config.targetPropertyId!);
      return cell?.value;
    });

    return this.applyRollupCalculation(config.calculation, values);
  }

  private applyRollupCalculation(
    calculation: string,
    values: unknown[]
  ): unknown {
    const isValueEmpty = (v: any) =>
      v == null || v === '' || (Array.isArray(v) && v.length === 0);

    switch (calculation) {
      case 'count_all':
        return values.length;
      case 'count_values':
        return values.flat().filter(v => !isValueEmpty(v)).length;
      case 'count_unique':
        return new Set(
          values
            .flat()
            .map(v =>
              typeof v === 'object' && v !== null ? JSON.stringify(v) : v
            )
        ).size;
      case 'count_empty':
        return values.filter(isValueEmpty).length;
      case 'count_not_empty':
        return values.filter(v => !isValueEmpty(v)).length;
      case 'sum':
      case 'average':
      case 'min':
      case 'max': {
        const nums = values
          .flat()
          .map(v => {
            if (typeof v === 'number') return v;
            if (typeof v === 'string' && v.trim() !== '') {
              const n = Number(v);
              if (!isNaN(n)) return n;
            }
            if (v instanceof Date) return v.getTime();
            return undefined;
          })
          .filter(v => v !== undefined) as number[];

        if (calculation === 'sum') return nums.reduce((a, b) => a + b, 0);
        if (calculation === 'average')
          return nums.length > 0
            ? nums.reduce((a, b) => a + b, 0) / nums.length
            : null;
        if (calculation === 'min')
          return nums.length > 0 ? Math.min(...nums) : null;
        return nums.length > 0 ? Math.max(...nums) : null; // max
      }
      case 'earliest':
      case 'latest': {
        const dates = values
          .flat()
          .map(v => {
            if (v instanceof Date) return v.getTime();
            if (typeof v === 'string') {
              const parsed = Date.parse(v);
              if (!isNaN(parsed)) return parsed;
            }
            if (typeof v === 'number') return v;
            return undefined;
          })
          .filter(v => v !== undefined) as number[];

        if (calculation === 'earliest')
          return dates.length > 0 ? new Date(Math.min(...dates)) : null;
        return dates.length > 0 ? new Date(Math.max(...dates)) : null; // latest
      }
      case 'show_original':
        return values.flat();
      default:
        return null;
    }
  }

  getViewColumn(id: string) {
    return this.block.props.columns.find(v => v.id === id);
  }

  listenToDoc(doc: Store) {
    this.docDisposeMap.set(
      doc.id,
      doc.slots.blockUpdated.subscribe(v => {
        if (v.type === 'add') {
          const blockById = doc.getBlock(v.id);
          if (blockById && this.meta.selector(blockById)) {
            this.blockMap.set(v.id, blockById);
          }
        } else if (v.type === 'delete') {
          this.blockMap.delete(v.id);
        }
        this.slots.update.next(undefined);
      }).unsubscribe
    );
  }

  private newColumnName() {
    let i = 1;
    while (
      this.block.props.columns.some(column => column.name === `Column ${i}`)
    ) {
      i++;
    }
    return `Column ${i}`;
  }

  propertyAdd(
    insertToPosition: InsertToPosition,
    ops?: {
      type?: string;
      name?: string;
    }
  ): string {
    const { type } = ops ?? {};
    const doc = this.block.store;
    doc.captureSync();
    const column = DatabaseBlockDataSource.propertiesMap.value[
      type ?? propertyPresets.multiSelectPropertyConfig.type
    ].create(this.newColumnName());

    const id = doc.workspace.idGenerator();
    if (this.block.props.columns.some(v => v.id === id)) {
      return id;
    }
    doc.transact(() => {
      const col: ColumnDataType = {
        ...column,
        id,
      };
      this.block.props.columns.splice(
        insertPositionToIndex(insertToPosition, this.block.props.columns),
        0,
        col
      );
    });
    this.slots.update.next();
    return id;
  }

  propertyDataGet(propertyId: string): Record<string, unknown> {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      return viewColumn.data as Record<string, unknown>;
    }
    const property = this.meta.properties.find(v => v.key === propertyId);
    if (!property) {
      return {};
    }
    return (
      property.getColumnData?.(this.blocks[0]?.model as BlockModel) ??
      property.metaConfig.config.propertyData.default()
    );
  }

  propertyDataSet(propertyId: string, data: Record<string, unknown>): void {
    const viewColumn = this.getViewColumn(propertyId);
    if (!viewColumn) return;

    this.block.store.captureSync();
    this.block.store.transact(() => {
      if (viewColumn.type === 'relation') {
        const oldData = (viewColumn.data ?? {}) as Record<string, any>;
        const newData = { ...oldData, ...data } as Record<string, any>;

        const oldTargetId = oldData.targetDatabaseId as string | undefined;
        const newTargetId = newData.targetDatabaseId as string | undefined;
        const newIsBi = newData.isBidirectional !== false;

        if (
          oldData.reversePropertyId &&
          (oldTargetId !== newTargetId || !newIsBi)
        ) {
          const oldTargetDb = this.block.store.getBlock(oldTargetId as string)
            ?.model as DatabaseBlockModel | undefined;
          if (oldTargetDb) {
            deleteColumn(oldTargetDb, oldData.reversePropertyId as string);
          }
          newData.reversePropertyId = null;
        }

        if (newTargetId && newIsBi && !newData.reversePropertyId) {
          const targetDb = this.block.store.getBlock(newTargetId)?.model as
            | DatabaseBlockModel
            | undefined;
          if (targetDb) {
            const newReversePropertyId =
              this.block.store.workspace.idGenerator();
            addProperty(targetDb, 'end', {
              id: newReversePropertyId,
              type: 'relation',
              name: `Related to ${this.block.props.title || 'Query view'}`,
              data: {
                targetDatabaseId: this.block.id,
                isBidirectional: true,
                isReverse: true,
                reversePropertyId: propertyId,
              },
            });
            newData.reversePropertyId = newReversePropertyId;
          }
        }

        viewColumn.data = newData;
      } else {
        viewColumn.data = { ...viewColumn.data, ...data };
      }
    });
    this.slots.update.next();
  }

  propertyDelete(_id: string): void {
    const index = this.block.props.columns.findIndex(v => v.id === _id);
    if (index < 0) return;
    const column = this.block.props.columns[index];
    if (!column) return;

    this.block.store.captureSync();
    this.block.store.transact(() => {
      if (column.type === 'relation') {
        const d = (column.data ?? {}) as Record<string, any>;
        const targetDatabaseId = d.targetDatabaseId as string | undefined;
        const reversePropertyId = d.reversePropertyId as string | undefined;
        const isReverse = d.isReverse === true;
        if (targetDatabaseId && reversePropertyId) {
          const targetModel = this.block.store.getBlock(targetDatabaseId)
            ?.model as BlockModel | undefined;
          if (targetModel) {
            if (isReverse) {
              updateColumnRelationData(
                targetModel,
                reversePropertyId,
                (data: Record<string, unknown>) => ({
                  ...data,
                  reversePropertyId: null,
                })
              );
            } else if (targetModel.flavour === 'affine:database') {
              deleteColumn(
                targetModel as DatabaseBlockModel,
                reversePropertyId
              );
            }
          }
        }
      }
      this.block.props.columns.splice(index, 1);
    });
    this.slots.update.next();
  }

  override propertyDuplicate(_columnId: string): string | undefined {
    const index = this.block.props.columns.findIndex(v => v.id === _columnId);
    if (index < 0) return;
    const col = this.block.props.columns[index]!;
    const newId = this.block.store.workspace.idGenerator();
    this.block.store.captureSync();
    this.block.store.transact(() => {
      this.block.props.columns.splice(index + 1, 0, {
        ...col,
        id: newId,
        name: `${col.name} (copy)`,
      });
    });
    this.slots.update.next();
    return newId;
  }

  override propertyMetaGet(type: string): PropertyMetaConfig | undefined {
    const meta = this.columnMetaMap.get(type);
    if (meta) {
      return meta;
    }
    return queryBlockAllColumnMap[type];
  }

  override propertyNameGet(propertyId: string): string {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      return viewColumn.name;
    }
    if (propertyId === 'type') {
      return 'Block Type';
    }
    return this.meta.properties.find(v => v.key === propertyId)?.name ?? '';
  }

  override propertyNameSet(propertyId: string, name: string): void {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      viewColumn.name = name;
      this.slots.update.next();
    }
  }

  override propertyReadonlyGet(propertyId: string): boolean {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      return false;
    }
    if (propertyId === 'type') return true;
    const metaProp = this.meta.properties.find(v => v.key === propertyId);
    return metaProp?.set == null;
  }

  override propertyTypeGet(propertyId: string): string | undefined {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      return viewColumn.type;
    }
    if (propertyId === 'type') {
      return 'image';
    }
    return this.meta.properties.find(v => v.key === propertyId)?.metaConfig
      .type;
  }

  override propertyTypeSet(propertyId: string, toType: string): void {
    const viewColumn = this.getViewColumn(propertyId);
    if (viewColumn) {
      const currentType = viewColumn.type;
      const currentData = viewColumn.data;
      const rows = this.rows$.value;
      const currentCells = rows.map(rowId =>
        this.cellValueGet(rowId, propertyId)
      );
      const convertFunction = databasePropertyConverts.find(
        v => v.from === currentType && v.to === toType
      )?.convert;
      const result = convertFunction?.(
        currentData as never,

        currentCells as never
      ) ?? {
        property:
          DatabaseBlockDataSource.propertiesMap.value[
            toType
          ].config.propertyData.default(),
        cells: currentCells.map(() => undefined),
      };
      this.block.store.captureSync();
      this.block.store.transact(() => {
        viewColumn.type = toType;
        viewColumn.data = result.property as Record<string, unknown>;
        currentCells.forEach((value, i) => {
          if (value != null || result.cells[i] != null) {
            this.block.props.cells[rows[i]!] = {
              ...this.block.props.cells[rows[i]!],
              [propertyId]: result.cells[i],
            };
          }
        });
      });
      this.slots.update.next();
    }
  }

  override propertyDataTypeGet(propertyId: string): TypeInstance | undefined {
    const viewColumn = this.getViewColumn(propertyId);
    if (!viewColumn) return undefined;
    const meta = this.propertyMetaGet(viewColumn.type);
    if (!meta) return undefined;
    return meta.config?.jsonValue.type({
      data: viewColumn.data,
      dataSource: this,
    });
  }

  override viewDataAdd(viewData: DataViewDataType): string {
    this.block.store.transact(() => {
      this.block.props.views.push(viewData as never);
    });
    this.slots.update.next();
    return viewData.id;
  }

  override viewDataDuplicate(id: string): string {
    const view = this.viewDataGet(id);
    if (!view) {
      throw new BlockSuiteError(
        BlockSuiteError.ErrorCode.ValueNotExists,
        `View ${id} not found`
      );
    }
    const newId = this.block.store.workspace.idGenerator();
    const duplicate = { ...view, id: newId, name: `${view.name} Copy` };
    return this.viewDataAdd(duplicate as DataViewDataType);
  }

  override viewDataDelete(viewId: string): void {
    this.block.store.transact(() => {
      const idx = this.block.props.views.findIndex(v => v.id === viewId);
      if (idx !== -1) {
        this.block.props.views.splice(idx, 1);
      }
    });
    this.slots.update.next();
  }

  override viewDataGet(viewId: string): DataViewDataType | undefined {
    return this.block.props.views.find(v => v.id === viewId) as
      | DataViewDataType
      | undefined;
  }

  override viewDataMoveTo(id: string, position: InsertToPosition): void {
    const views = this.block.props.views;
    const current = views.findIndex(v => v.id === id);
    if (current === -1) return;
    const view = views[current]!;
    this.block.store.transact(() => {
      views.splice(current, 1);
      let target: number;
      if (position === 'start') {
        target = 0;
      } else if (position === 'end') {
        target = views.length;
      } else {
        const refIdx = views.findIndex(v => v.id === position.id);
        target =
          refIdx === -1 ? views.length : refIdx + (position.before ? 0 : 1);
      }
      views.splice(Math.max(0, target), 0, view);
    });
    this.slots.update.next();
  }

  override viewDataUpdate<ViewData extends DataViewDataType>(
    id: string,
    updater: (data: ViewData) => Partial<ViewData>
  ): void {
    this.block.store.transact(() => {
      this.block.props.views = this.block.props.views.map(v => {
        if (v.id !== id) {
          return v;
        }
        return { ...v, ...updater(v as ViewData) };
      });
    });
    this.slots.update.next();
  }

  override viewMetaGet(type: string): ViewMeta {
    const view = blockQueryViewMap[type];
    if (!view) {
      console.warn(
        `[AFFiNE] Unknown data-view view type "${type}", falling back.`
      );
      return blockQueryViews[0]!;
    }
    return view;
  }

  override viewMetaGetById(viewId: string): ViewMeta | undefined {
    const view = this.viewDataGet(viewId);
    if (!view) return undefined;
    if (!blockQueryViewMap[view.mode]) return undefined;
    return this.viewMetaGet(view.mode);
  }

  rowAdd(_insertPosition: InsertToPosition | number): string {
    throw new Error('Method not implemented.');
  }

  rowDelete(_ids: string[]): void {
    throw new Error('Method not implemented.');
  }

  rowMove(_rowId: string, _position: InsertToPosition): void {}
}
