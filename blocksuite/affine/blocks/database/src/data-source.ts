import type {
  ColumnDataType,
  ColumnUpdater,
  DatabaseBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import { getSelectedModelsCommand } from '@blocksuite/affine-shared/commands';
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
  type ViewManager,
  ViewManagerBase,
  type ViewMeta,
} from '@blocksuite/data-view';
import {
  propertyPresets,
  type RollupCalculation,
  type RollupPropertyData,
} from '@blocksuite/data-view/property-presets';
import { IS_MOBILE } from '@blocksuite/global/env';
import { BlockSuiteError, ErrorCode } from '@blocksuite/global/exceptions';
import type { EditorHost } from '@blocksuite/std';
import { type BlockModel } from '@blocksuite/store';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';

import { getIcon } from './block-icons.js';
import {
  databaseBlockProperties,
  databasePropertyConverts,
} from './properties/index.js';
import {
  addProperty,
  copyCellsByProperty,
  deleteColumn,
  deleteRows,
  deleteView,
  duplicateView,
  getCell,
  getProperty,
  moveViewTo,
  updateCell,
  updateCells,
  updateProperty,
  updateView,
} from './utils/block-utils.js';
import {
  databaseBlockViewConverts,
  databaseBlockViewMap,
  databaseBlockViews,
} from './views/index.js';

type SpacialProperty = {
  valueSet: (rowId: string, propertyId: string, value: unknown) => void;
  valueGet: (rowId: string, propertyId: string) => unknown;
};

export class DatabaseBlockDataSource extends DataSourceBase {
  override get parentProvider() {
    return this._model.store.provider;
  }

  spacialProperties: Record<string, SpacialProperty> = {
    'created-time': {
      valueSet: () => {},
      valueGet: (rowId: string) => {
        const model = this.getModelById(rowId) as ParagraphBlockModel;
        if (!model) {
          return null;
        }
        return model.props['meta:createdAt'];
      },
    },
    'created-by': {
      valueSet: () => {},
      valueGet: (rowId: string) => {
        const model = this.getModelById(rowId) as
          | ParagraphBlockModel
          | undefined;
        return model ? model.props['meta:createdBy'] : null;
      },
    },
    type: {
      valueSet: () => {},
      valueGet: (rowId: string) => {
        const model = this.getModelById(rowId);
        if (!model) {
          return;
        }
        return getIcon(model);
      },
    },
    title: {
      valueSet: () => {},
      valueGet: (rowId: string) => {
        const model = this.getModelById(rowId);
        if (!model) {
          return;
        }
        return model.text;
      },
    },
  };

  isSpacialProperty(propertyType: string): boolean {
    return this.spacialProperties[propertyType] !== undefined;
  }

  spacialValueGet(
    rowId: string,
    propertyId: string,
    propertyType: string
  ): unknown {
    return this.spacialProperties[propertyType]?.valueGet(rowId, propertyId);
  }

  static externalProperties = signal<PropertyMetaConfig[]>([]);
  static propertiesList = computed(() => {
    return [
      ...Object.values(databaseBlockProperties),
      ...this.externalProperties.value,
    ];
  });
  static propertiesMap = computed(() => {
    return Object.fromEntries(
      this.propertiesList.value.map(v => [v.type, v as PropertyMetaConfig])
    );
  });

  private _batch = 0;

  private readonly _model: DatabaseBlockModel;

  override featureFlags$: ReadonlySignal<DatabaseFlags> = computed(() => {
    const featureFlagService = this.doc.get(FeatureFlagService);
    const enableTableVirtualScroll = featureFlagService.getFlag(
      'enable_table_virtual_scroll'
    );
    return {
      enable_table_virtual_scroll: enableTableVirtualScroll ?? false,
    };
  });

  properties$: ReadonlySignal<string[]> = computed(() => {
    const fixedPropertiesSet = new Set(this.fixedProperties$.value);
    const properties: string[] = [];
    this._model.props.columns$.value.forEach(column => {
      if (fixedPropertiesSet.has(column.type)) {
        fixedPropertiesSet.delete(column.type);
      }
      properties.push(column.id);
    });

    const result = [...fixedPropertiesSet, ...properties];
    return result;
  });

  readonly$: ReadonlySignal<boolean> = computed(() => {
    return (
      this._model.store.readonly ||
      (IS_MOBILE &&
        !this._model.store.provider
          .get(FeatureFlagService)
          .getFlag('enable_mobile_database_editing'))
    );
  });

  rows$: ReadonlySignal<string[]> = computed(() => {
    return this._model.children.map(v => v.id);
  });

  viewConverts = databaseBlockViewConverts;

  viewDataList$: ReadonlySignal<DataViewDataType[]> = computed(() => {
    return this._model.props.views$.value as DataViewDataType[];
  });

  override viewManager: ViewManager = new ViewManagerBase(this);

  viewMetas = databaseBlockViews;

  get doc() {
    return this._model.store;
  }

  allPropertyMetas$ = computed<PropertyMetaConfig<any, any, any, any>[]>(() => {
    return DatabaseBlockDataSource.propertiesList.value;
  });

  propertyMetas$ = computed<PropertyMetaConfig[]>(() => {
    return this.allPropertyMetas$.value.filter(
      v => !v.config.fixed && !v.config.hide
    );
  });

  constructor(
    model: DatabaseBlockModel,
    init?: (dataSource: DatabaseBlockDataSource) => void
  ) {
    super();
    this._model = model; // ensure invariants first
    init?.(this); // then allow external initialisation
  }

  private _runCapture() {
    if (this._batch) {
      return;
    }

    this._batch = requestAnimationFrame(() => {
      this.doc.captureSync();
      this._batch = 0;
    });
  }

  private getModelById(rowId: string): BlockModel | undefined {
    return this._model.children[this._model.childMap.value.get(rowId) ?? -1];
  }

  private newPropertyName(prefix = 'Column'): string {
    let i = 1;
    const hasSameName = (name: string) => {
      return this._model.props.columns$.value.some(
        column => column.name === name
      );
    };
    while (true) {
      let name = i === 1 ? prefix : `${prefix} ${i}`;
      if (!hasSameName(name)) {
        return name;
      }
      i++;
    }
  }

  cellValueChange(rowId: string, propertyId: string, value: unknown): void {
    this._runCapture();

    const type = this.propertyTypeGet(propertyId);
    if (type == null) {
      return;
    }
    const update = this.propertyMetaGet(type)?.config.rawValue.setValue;
    const old = this.cellValueGet(rowId, propertyId);
    const updateFn =
      update ??
      (({ setValue, newValue }) => {
        setValue(newValue);
      });
    updateFn({
      value: old,
      data: this.propertyDataGet(propertyId),
      dataSource: this,
      newValue: value,
      setValue: newValue => {
        if (this._model.props.columns$.value.some(v => v.id === propertyId)) {
          this.doc.transact(() => {
            updateCell(this._model, rowId, {
              columnId: propertyId,
              value: newValue,
            });

            if (type === 'relation') {
              const data = this.propertyDataGet(propertyId) as any;
              const reversePropertyId = data?.reversePropertyId as
                | string
                | undefined;
              const targetDatabaseId = data?.targetDatabaseId as
                | string
                | undefined;

              if (reversePropertyId && targetDatabaseId) {
                const targetDb = this.doc.getBlock(targetDatabaseId)
                  ?.model as any;
                if (targetDb) {
                  const oldArray = (Array.isArray(old) ? old : []) as string[];
                  const newArray = (
                    Array.isArray(newValue) ? newValue : []
                  ) as string[];

                  const added = newArray.filter(id => !oldArray.includes(id));
                  const removed = oldArray.filter(id => !newArray.includes(id));

                  added.forEach(targetRowId => {
                    const cell = getCell(
                      targetDb,
                      targetRowId,
                      reversePropertyId
                    );
                    const cellVal = (
                      Array.isArray(cell?.value) ? cell.value : []
                    ) as string[];
                    if (!cellVal.includes(rowId)) {
                      updateCell(targetDb, targetRowId, {
                        columnId: reversePropertyId,
                        value: [...cellVal, rowId],
                      });
                    }
                  });

                  removed.forEach(targetRowId => {
                    const cell = getCell(
                      targetDb,
                      targetRowId,
                      reversePropertyId
                    );
                    const cellVal = (
                      Array.isArray(cell?.value) ? cell.value : []
                    ) as string[];
                    if (cellVal.includes(rowId)) {
                      updateCell(targetDb, targetRowId, {
                        columnId: reversePropertyId,
                        value: cellVal.filter(id => id !== rowId),
                      });
                    }
                  });
                }
              }
            }
          });
        }
      },
    });
  }

  cellValueGet(rowId: string, propertyId: string): unknown {
    if (this.isSpacialProperty(propertyId)) {
      return this.spacialValueGet(rowId, propertyId, propertyId);
    }
    const type = this.propertyTypeGet(propertyId);
    if (!type) {
      return;
    }
    if (this.isSpacialProperty(type)) {
      return this.spacialValueGet(rowId, propertyId, type);
    }

    if (type === 'rollup') {
      return this._computeRollup(rowId, propertyId);
    }

    const meta = this.propertyMetaGet(type);
    if (!meta) {
      return;
    }
    const rawValue =
      getCell(this._model, rowId, propertyId)?.value ??
      meta.config.rawValue.default();
    const schema = meta.config.rawValue.schema;
    const result = schema.safeParse(rawValue);
    if (result.success) {
      return result.data;
    }
    return;
  }

  propertyAdd(
    insertToPosition: InsertToPosition,
    ops?: {
      type?: string;
      name?: string;
    }
  ): string | undefined {
    this.doc.captureSync();
    const { type, name } = ops ?? {};
    const property = this.propertyMetaGet(
      type ?? propertyPresets.multiSelectPropertyConfig.type
    );
    if (!property) {
      return;
    }
    const result = addProperty(
      this._model,
      insertToPosition,
      property.create(this.newPropertyName(name))
    );
    return result;
  }

  protected override getNormalPropertyAndIndex(propertyId: string):
    | {
        column: ColumnDataType<Record<string, unknown>>;
        index: number;
      }
    | undefined {
    const index = this._model.props.columns$.value.findIndex(
      v => v.id === propertyId
    );
    if (index >= 0) {
      const column = this._model.props.columns$.value[index];
      if (!column) {
        return;
      }
      return {
        column,
        index,
      };
    }
    return;
  }

  private getPropertyAndIndex(propertyId: string):
    | {
        column: ColumnDataType<Record<string, unknown>>;
        index: number;
      }
    | undefined {
    const result = this.getNormalPropertyAndIndex(propertyId);
    if (result) {
      return result;
    }
    if (this.isFixedProperty(propertyId)) {
      const meta = this.propertyMetaGet(propertyId);
      if (!meta) {
        return;
      }
      const defaultData = meta.config.fixed?.defaultData ?? {};
      return {
        column: {
          data: defaultData,
          id: propertyId,
          type: propertyId,
          name: meta.config.name,
        },
        index: -1,
      };
    }
    return undefined;
  }

  private updateProperty(id: string, updater: ColumnUpdater) {
    const result = this.getPropertyAndIndex(id);
    if (!result) {
      return;
    }
    const { column: prevColumn, index } = result;
    this._model.store.transact(() => {
      if (index >= 0) {
        const result = updater(prevColumn);
        this._model.props.columns[index] = { ...prevColumn, ...result };
      } else {
        const result = updater(prevColumn);
        this._model.props.columns = [
          ...this._model.props.columns,
          { ...prevColumn, ...result },
        ];
      }
    });
    return id;
  }

  propertyDataGet(propertyId: string): Record<string, unknown> {
    const result = this.getPropertyAndIndex(propertyId);
    if (!result) {
      return {};
    }
    return result.column.data;
  }

  propertyDataSet(propertyId: string, data: Record<string, unknown>): void {
    this._runCapture();

    this.doc.transact(() => {
      const result = this.getPropertyAndIndex(propertyId);
      if (result) {
        const column = result.column;
        if (column.type === 'relation') {
          const oldData = (column.data ?? {}) as Record<string, any>;
          const newData = (data ?? {}) as Record<string, any>;

          const oldTargetId = oldData.targetDatabaseId as string | undefined;
          const newTargetId = newData.targetDatabaseId as string | undefined;
          const newIsBi = newData.isBidirectional !== false;

          // Clean up old reverse property if target changed or bidirectional turned off
          if (
            oldData.reversePropertyId &&
            (oldTargetId !== newTargetId || !newIsBi)
          ) {
            const oldTargetDb = this.doc.getBlock(oldTargetId as string)
              ?.model as DatabaseBlockModel | undefined;
            if (oldTargetDb) {
              deleteColumn(oldTargetDb, oldData.reversePropertyId as string);
            }
            newData.reversePropertyId = null;
          }

          // Create new reverse property if target set and bidirectional ON
          if (newTargetId && newIsBi && !newData.reversePropertyId) {
            const targetDb = this.doc.getBlock(newTargetId)?.model as
              | DatabaseBlockModel
              | undefined;
            if (targetDb) {
              const newReversePropertyId = this.doc.workspace.idGenerator();
              addProperty(targetDb, 'end', {
                id: newReversePropertyId,
                type: 'relation',
                name: `Related to ${this._model.props.title?.toString() || 'Database'}`,
                data: {
                  targetDatabaseId: this._model.id,
                  isBidirectional: true,
                  isReverse: true,
                  reversePropertyId: propertyId,
                },
              });
              newData.reversePropertyId = newReversePropertyId;
            }
          }
        }
      }

      this.updateProperty(propertyId, () => ({ data }));
    });
  }

  propertyDataTypeGet(propertyId: string): TypeInstance | undefined {
    const result = this.getPropertyAndIndex(propertyId);
    if (!result) {
      return;
    }
    const { column } = result;
    const meta = this.propertyMetaGet(column.type);
    if (!meta) {
      return;
    }
    return meta.config?.jsonValue.type({
      data: column.data,
      dataSource: this,
    });
  }

  propertyDelete(id: string): void {
    if (this.isFixedProperty(id)) {
      return;
    }
    this.doc.captureSync();
    const index = this._model.props.columns.findIndex(v => v.id === id);
    if (index < 0) return;

    this.doc.transact(() => {
      const column = this._model.props.columns[index];
      if (!column) return;
      if (column.type === 'relation') {
        const data = (column.data ?? {}) as Record<string, any>;
        const targetDatabaseId = data.targetDatabaseId as string | undefined;
        const reversePropertyId = data.reversePropertyId as string | undefined;
        const isReverse = data.isReverse === true;

        if (targetDatabaseId && reversePropertyId) {
          const targetDb = this.doc.getBlock(targetDatabaseId)?.model as
            | DatabaseBlockModel
            | undefined;
          if (targetDb) {
            if (isReverse) {
              // Task 2.5: Detach from forward
              updateProperty(targetDb, reversePropertyId, col => ({
                data: {
                  ...col.data,
                  reversePropertyId: null,
                },
              }));
            } else {
              // Task 2.4: Delete reverse column in target
              deleteColumn(targetDb, reversePropertyId);
            }
          }
        }
      }

      this._model.props.columns = this._model.props.columns.filter(
        (_, i) => i !== index
      );
    });
  }

  propertyDuplicate(propertyId: string): string | undefined {
    if (this.isFixedProperty(propertyId)) {
      return;
    }
    this.doc.captureSync();
    const currentSchema = getProperty(this._model, propertyId);
    if (!currentSchema) {
      return;
    }
    const { id: copyId, ...nonIdProps } = currentSchema;
    const names = new Set(this._model.props.columns$.value.map(v => v.name));
    let index = 1;
    while (names.has(`${nonIdProps.name}(${index})`)) {
      index++;
    }
    const schema = { ...nonIdProps, name: `${nonIdProps.name}(${index})` };
    const id = addProperty(
      this._model,
      {
        before: false,
        id: propertyId,
      },
      schema
    );
    copyCellsByProperty(this._model, copyId, id);
    return id;
  }

  propertyMetaGet(type: string): PropertyMetaConfig | undefined {
    return DatabaseBlockDataSource.propertiesMap.value[type];
  }

  propertyNameGet(propertyId: string): string {
    if (propertyId === 'type') {
      return 'Block Type';
    }
    const result = this.getPropertyAndIndex(propertyId);
    if (!result) {
      return '';
    }
    return result.column.name;
  }

  propertyNameSet(propertyId: string, name: string): void {
    this.doc.captureSync();
    this.updateProperty(propertyId, () => ({ name }));
  }

  override propertyReadonlyGet(propertyId: string): boolean {
    if (propertyId === 'type') return true;
    return false;
  }

  propertyTypeGet(propertyId: string): string | undefined {
    if (propertyId === 'type') {
      return 'image';
    }
    const result = this.getPropertyAndIndex(propertyId);
    if (!result) {
      return;
    }
    return result.column.type;
  }

  propertyTypeSet(propertyId: string, toType: string): void {
    if (this.isFixedProperty(propertyId)) {
      return;
    }
    const meta = this.propertyMetaGet(toType);
    if (!meta) {
      return;
    }
    const currentType = this.propertyTypeGet(propertyId);
    const currentData = this.propertyDataGet(propertyId);
    const rows = this.rows$.value;
    const currentCells = rows.map(rowId =>
      this.cellValueGet(rowId, propertyId)
    );
    const convertFunction = databasePropertyConverts.find(
      v => v.from === currentType && v.to === toType
    )?.convert;
    const result = convertFunction?.(
      currentData as any,

      currentCells as any
    ) ?? {
      property: meta.config.propertyData.default(),
      cells: currentCells.map(() => undefined),
    };
    this.doc.captureSync();
    updateProperty(this._model, propertyId, () => ({
      type: toType,
      data: result.property,
    }));
    const cells: Record<string, unknown> = {};
    currentCells.forEach((value, i) => {
      if (value != null || result.cells[i] != null) {
        const rowId = rows[i];
        if (rowId) {
          cells[rowId] = result.cells[i];
        }
      }
    });
    updateCells(this._model, propertyId, cells);
  }

  rowAdd(insertPosition: InsertToPosition | number): string {
    this.doc.captureSync();
    const index =
      typeof insertPosition === 'number'
        ? insertPosition
        : insertPositionToIndex(insertPosition, this._model.children);
    return this.doc.addBlock('affine:paragraph', {}, this._model.id, index);
  }

  rowDelete(ids: string[]): void {
    this.doc.captureSync();
    for (const id of ids) {
      const block = this.doc.getBlock(id);
      if (block) {
        this.doc.deleteBlock(block.model);
      }
    }
    deleteRows(this._model, ids);
  }

  rowMove(rowId: string, position: InsertToPosition): void {
    const model = this.doc.getModelById(rowId);
    if (model) {
      const index = insertPositionToIndex(position, this._model.children);
      const target = this._model.children[index];
      if (target?.id === rowId) {
        return;
      }
      this.doc.moveBlocks([model], this._model, target);
    }
  }

  viewDataAdd(viewData: DataViewDataType): string {
    this._model.store.captureSync();
    this._model.store.transact(() => {
      this._model.props.views = [...this._model.props.views, viewData];
    });
    return viewData.id;
  }

  viewDataDelete(viewId: string): void {
    this._model.store.captureSync();
    deleteView(this._model, viewId);
  }

  viewDataDuplicate(id: string): string {
    return duplicateView(this._model, id);
  }

  viewDataGet(viewId: string): DataViewDataType | undefined {
    return this.viewDataList$.value.find(data => data.id === viewId)!;
  }

  viewDataMoveTo(id: string, position: InsertToPosition): void {
    moveViewTo(this._model, id, position);
  }

  viewDataUpdate<ViewData extends DataViewDataType>(
    id: string,
    updater: (data: ViewData) => Partial<ViewData>
  ): void {
    updateView(this._model, id, updater);
  }

  viewMetaGet(type: string): ViewMeta {
    const view = databaseBlockViewMap[type];
    if (!view) {
      // Defensive fallback for forward-compatibility: an old client opening a
      // doc written by a newer client may encounter an unknown view mode.
      // Return the first registered view rather than throwing, so the database
      // renders in a degraded-but-stable state instead of crashing.
      console.warn(
        `[AFFiNE] Unknown database view type "${type}". Falling back to default view.`
      );
      return databaseBlockViews[0]!;
    }
    return view;
  }

  viewMetaGetById(viewId: string): ViewMeta | undefined {
    const view = this.viewDataGet(viewId);
    if (!view) return;
    // Short-circuit before viewMetaGet if the mode is unrecognised — lets
    // viewGet() return undefined and the view manager skip this view safely.
    if (!databaseBlockViewMap[view.mode]) return;
    return this.viewMetaGet(view.mode);
  }

  private _computeRollup(rowId: string, propertyId: string): unknown {
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
    if (!relationValue || (relationValue && relationValue.length === 0)) {
      return null;
    }

    const relationData = this.propertyDataGet(config.relationPropertyId) as any;
    const targetDatabaseId = relationData?.targetDatabaseId;
    if (!targetDatabaseId) {
      return null;
    }

    const targetDb = this.doc.getBlock(targetDatabaseId)?.model as
      | DatabaseBlockModel
      | undefined;
    if (!targetDb) {
      return null;
    }

    const values = (relationValue || [])
      .map(targetRowId => {
        const cell = getCell(targetDb, targetRowId, config.targetPropertyId);
        return cell?.value;
      })
      .filter(v => v !== undefined);

    return this._applyRollupCalculation(config.calculation, values);
  }

  private _applyRollupCalculation(
    calculation: RollupCalculation,
    values: unknown[]
  ): unknown {
    switch (calculation) {
      case 'count_all':
        return values.length;
      case 'count_values':
        return values.filter(v => v !== null && v !== undefined).length;
      case 'count_unique':
        return new Set(values).size;
      case 'count_empty':
        return values.filter(v => v == null).length;
      case 'count_not_empty':
        return values.filter(v => v != null).length;
      case 'sum':
        return (values as any[]).reduce(
          (a, b) => (Number(a) || 0) + (Number(b) || 0),
          0
        );
      case 'average':
        return values.length > 0
          ? (values as any[]).reduce(
              (a, b) => (Number(a) || 0) + (Number(b) || 0),
              0
            ) / values.length
          : 0;
      case 'min':
        return values.length > 0
          ? Math.min(...values.map(v => Number(v) || 0))
          : null;
      case 'max':
        return values.length > 0
          ? Math.max(...values.map(v => Number(v) || 0))
          : null;
      case 'earliest': {
        const dates = values
          .map(v => (v instanceof Date ? v.getTime() : Number(v)))
          .filter(v => !isNaN(v));
        return dates.length > 0 ? new Date(Math.min(...dates)) : null;
      }
      case 'latest': {
        const dates = values
          .map(v => (v instanceof Date ? v.getTime() : Number(v)))
          .filter(v => !isNaN(v));
        return dates.length > 0 ? new Date(Math.max(...dates)) : null;
      }
      case 'show_original':
        return values;
      default:
        return null;
    }
  }
}

export const databaseViewInitTemplate = (
  datasource: DatabaseBlockDataSource,
  viewType: string
) => {
  Array.from({ length: 3 }).forEach(() => {
    datasource.rowAdd('end');
  });
  datasource.viewManager.viewAdd(viewType);
};
export const convertToDatabase = (host: EditorHost, viewType: string) => {
  const [_, ctx] = host.std.command.exec(getSelectedModelsCommand, {
    types: ['block', 'text'],
  });
  const { selectedModels } = ctx;
  const firstModel = selectedModels?.[0];
  if (!firstModel) return;

  host.store.captureSync();

  const parentModel = host.store.getParent(firstModel);
  if (!parentModel) {
    return;
  }

  const id = host.store.addBlock(
    'affine:database',
    {},
    parentModel,
    parentModel.children.indexOf(firstModel)
  );
  const databaseModel = host.store.getBlock(id)?.model as
    | DatabaseBlockModel
    | undefined;
  if (!databaseModel) {
    return;
  }
  const datasource = new DatabaseBlockDataSource(databaseModel);
  datasource.viewManager.viewAdd(viewType);
  host.store.moveBlocks(selectedModels, databaseModel);

  const selectionManager = host.selection;
  selectionManager.clear();
};
