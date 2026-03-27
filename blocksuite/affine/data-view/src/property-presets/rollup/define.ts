import * as zod from 'zod';

import { t } from '../../core/index.js';
import { propertyType } from '../../core/property/property-config.js';

export const rollupPropertyType = propertyType('rollup');

export const RollupCalculationSchema = zod.enum([
  'count_all',
  'count_values',
  'count_unique',
  'count_empty',
  'count_not_empty',
  'sum',
  'average',
  'min',
  'max',
  'earliest',
  'latest',
  'show_original',
]);

export type RollupCalculation = zod.infer<typeof RollupCalculationSchema>;

export const RollupPropertySchema = zod.object({
  relationPropertyId: zod.string(),
  targetPropertyId: zod.string(),
  calculation: RollupCalculationSchema,
});

export type RollupPropertyData = zod.infer<typeof RollupPropertySchema>;

export const rollupPropertyModelConfig = rollupPropertyType.modelConfig({
  name: 'Rollup',
  propertyData: {
    schema: RollupPropertySchema,
    default: () => ({
      relationPropertyId: '',
      targetPropertyId: '',
      calculation: 'count_all',
    }),
  },
  rawValue: {
    schema: zod.any(),
    default: () => null,
    toString: ({ value }) => {
      if (value == null) return '';
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    },
    fromString: () => ({ value: null }),
    toJson: ({ value }) => value,
    fromJson: ({ value }) => value,
  },
  jsonValue: {
    schema: zod.any(),
    type: () => t.unknown.instance(),
    isEmpty: ({ value }) => value == null,
  },
});
