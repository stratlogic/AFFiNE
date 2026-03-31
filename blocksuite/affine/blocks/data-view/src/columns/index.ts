import { richTextColumnConfig } from '@blocksuite/affine-block-database';
import type { PropertyMetaConfig } from '@blocksuite/data-view';
import { propertyPresets } from '@blocksuite/data-view/property-presets';

/** Preset object includes relation/rollup at runtime; widen for query block columns. */
const presets = propertyPresets as typeof propertyPresets &
  Record<string, PropertyMetaConfig<string, any, any, any>>;

export const queryBlockColumns = [
  propertyPresets.datePropertyConfig,
  propertyPresets.numberPropertyConfig,
  propertyPresets.progressPropertyConfig,
  propertyPresets.selectPropertyConfig,
  propertyPresets.multiSelectPropertyConfig,
  propertyPresets.checkboxPropertyConfig,
  presets.relationPropertyConfig,
  presets.rollupPropertyConfig,
];
export const queryBlockHiddenColumns: PropertyMetaConfig<
  string,
  any,
  any,
  any
>[] = [richTextColumnConfig];
const queryBlockAllColumns = [...queryBlockColumns, ...queryBlockHiddenColumns];
export const queryBlockAllColumnMap = Object.fromEntries(
  queryBlockAllColumns.map(v => [v.type, v as PropertyMetaConfig])
);
