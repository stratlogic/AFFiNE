import * as zod from 'zod';

import { t } from '../../core/index.js';
import { propertyType } from '../../core/property/property-config.js';

export const relationPropertyType = propertyType('relation');

export const RelationPropertySchema = zod.object({
  targetDatabaseId: zod.string(),
  /** When set and different from the source doc id, target DB lives in another page (cross-teamspace / cross-doc). */
  targetDocId: zod.string().optional(),
  isBidirectional: zod.boolean().default(true),
  isReverse: zod.boolean().default(false),
  reversePropertyId: zod.string().nullable().default(null),
  /** When set, relation targets another workspace; UI treats column as view-only (relay WIP). */
  crossWorkspaceTargetWorkspaceId: zod.string().optional(),
  /** Enforced read-only cell editing for relayed cross-workspace relations. */
  crossWorkspaceRelayReadOnly: zod.boolean().optional(),
});

export type RelationPropertyData = zod.infer<typeof RelationPropertySchema>;

export const relationPropertyModelConfig = relationPropertyType.modelConfig({
  name: 'Relation',
  propertyData: {
    schema: RelationPropertySchema,
    default: () => ({
      targetDatabaseId: '',
      targetDocId: undefined,
      isBidirectional: true,
      isReverse: false,
      reversePropertyId: null,
      crossWorkspaceTargetWorkspaceId: undefined,
      crossWorkspaceRelayReadOnly: undefined,
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
