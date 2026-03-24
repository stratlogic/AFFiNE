import * as zod from 'zod';

import { t } from '../../core/index.js';
import { propertyType } from '../../core/property/property-config.js';

export const relationPropertyType = propertyType('relation');

export const RelationPropertySchema = zod.object({
  targetDatabaseId: zod.string(),
  isReverse: zod.boolean().default(false),
  reversePropertyId: zod.string().nullable().default(null),
});

export type RelationPropertyData = zod.infer<typeof RelationPropertySchema>;

export const relationPropertyModelConfig = relationPropertyType.modelConfig({
  name: 'Relation',
  propertyData: {
    schema: RelationPropertySchema,
    default: () => ({
      targetDatabaseId: '',
      isReverse: false,
      reversePropertyId: null,
    }),
  },
  rawValue: {
    schema: zod.array(zod.string()).nullable(),
    default: () => null,
    toString: ({ value }) => {
      return (value ?? []).join(', ');
    },
    fromString: () => {
      return { value: null };
    },
    toJson: ({ value }) => value,
    fromJson: ({ value }) => value,
  },
  jsonValue: {
    schema: zod.array(zod.string()).nullable(),
    type: () => t.array.instance(t.string.instance()),
    isEmpty: ({ value }) => !value || value.length === 0,
  },
});
