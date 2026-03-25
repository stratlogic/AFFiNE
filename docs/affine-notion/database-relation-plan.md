# Implementation Plan: Notion-Like Database Features for AFFiNE

## Overview

This plan describes how to add Notion-parity database features to AFFiNE — specifically **relations between tables**, **rollups**, **linked database views**, and **additional view types** — using AFFiNE's existing infrastructure: BlockSuite (block model + data-view framework), Yjs (CRDTs), and OctoBase.

The core design constraint is that **relations only work within a single workspace**. This dramatically simplifies the CRDT synchronization problem: all databases share the same Yjs document space, eliminating cross-workspace reference resolution entirely.

### Constraints & Assumptions

- Relations are **workspace-scoped** — no cross-workspace linking
- All target databases must be within the workspace's Yjs document graph
- We use AFFiNE's existing `DataSourceBase`, `PropertyConfig`, and `ViewMeta` abstractions — no new frameworks
- The implementation should be incremental: each phase ships independently

---

## Architecture Context

Before diving into tasks, here's how AFFiNE's database system is structured — because every decision in this plan depends on these layers.

### Layer 1: Block Model (`@blocksuite/affine-model`)

The `DatabaseBlockModel` defines the schema:

```typescript
// blocksuite/affine/model/src/blocks/database/database-model.ts
type DatabaseBlockProps = {
  views: ViewBasicDataType[]; // array of view configs (table, kanban, etc.)
  title: Text; // database title (CRDT text)
  cells: SerializedCells; // Record<rowId, Record<columnId, CellData>>
  columns: Array<ColumnDataType>; // column definitions (id, type, name, data)
  comments?: Record<string, boolean>;
};
```

Each database is an `affine:database` block. Rows are **child blocks** (typically `affine:paragraph`). Columns are stored in `columns`. Cell values are stored in `cells[rowId][columnId]`.

### Layer 2: Property System (`@blocksuite/data-view`)

Properties are defined via `propertyType(typeName).modelConfig({...})`. Each property type declares:

- `propertyData` — schema + defaults for column-level config
- `rawValue` — schema + serialization for cell values
- `jsonValue` — type info for filtering/sorting

Existing property types: `checkbox`, `date`, `select`, `multi-select`, `number`, `progress`, `image`, `link`, `rich-text`, `title`, `created-time`.

### Layer 3: Data Source (`DatabaseBlockDataSource`)

Bridges the block model to the data-view UI. Implements `DataSourceBase` with methods for CRUD on rows, properties, cells, and views. This is the integration point where new property types become functional.

### Layer 4: View System

Views are defined via `viewType(typeName).createModel({...}).createMeta({...})`. Currently only `table` and `kanban` are registered in `databaseBlockViews`.

---

## Phase 1: Relation Property Type (One-Way)

### Goal

Allow a column in Database A to reference rows in Database B (within the same workspace). No reverse column yet.

### Task 1.1 — Define the Relation Property Model

**What:** Create a new property type `relation` in the data-view property-presets system.

**Where:**

- New directory: `blocksuite/affine/data-view/src/property-presets/relation/`
- Files: `define.ts`, `cell-renderer.ts`, `index.ts`

**Data Model:**

```typescript
// define.ts
import { propertyType } from '../../core/property/property-config.js';
import zod from 'zod';

export const relationPropertyType = propertyType('relation');

export const RelationPropertySchema = zod.object({
  // The block ID of the target database block
  targetDatabaseId: zod.string(),
  // Whether this is the "reverse" side of a bidirectional relation
  isReverse: zod.boolean().default(false),
  // If bidirectional, the property ID of the counterpart in the target database
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
    // Cell value is an array of row IDs from the target database
    schema: zod.array(zod.string()).nullable(),
    default: () => null,
    toString: ({ value, data }) => {
      // Display as comma-separated row titles (resolved at render time)
      return (value ?? []).join(', ');
    },
    fromString: ({ value }) => {
      // Not meaningful for relations — relations are set via picker, not text input
      return { value: null };
    },
    toJson: ({ value }) => value,
    fromJson: ({ value }) => value,
  },
  jsonValue: {
    schema: zod.array(zod.string()).nullable(),
    type: () => t.array.instance(), // or a custom relation type
    isEmpty: ({ value }) => !value || value.length === 0,
  },
});
```

**Why this shape:** The `targetDatabaseId` is a block ID, not a page ID. Since we constrain to single workspace, this ID is always resolvable via `store.getBlock(id)`. The cell value is an array of row IDs (block IDs of child paragraphs in the target database), enabling many-to-many.

### Task 1.2 — Relation Cell Renderer

**What:** A UI component that displays linked row titles as chips/tags and provides a picker modal to search and select rows from the target database.

**Where:** `blocksuite/affine/data-view/src/property-presets/relation/cell-renderer.ts`

**Behavior:**

1. **Read mode:** Display linked row titles as clickable chips. Each chip shows the title column value of the referenced row.
2. **Edit mode:** Click the cell → open a popup/modal listing all rows from the target database. Search field at top. Checkboxes for multi-select. Selected rows are persisted as an array of row IDs in the cell value.
3. **Chip click:** Navigate to / open the referenced row's detail panel.

**Resolving row titles:**

```typescript
// Given a target database block ID and a row ID, get the row's title:
function getRowTitle(store: BlockStore, targetDbId: string, rowId: string): string {
  const targetDb = store.getBlock(targetDbId)?.model as DatabaseBlockModel;
  if (!targetDb) return '(deleted)';
  const row = store.getBlock(rowId)?.model;
  if (!row) return '(deleted)';
  return row.text?.toString() ?? 'Untitled';
}
```

### Task 1.3 — Relation Configuration Panel

**What:** When the user adds a Relation property, they need to select which database to relate to. This needs a configuration UI.

**Flow:**

1. User clicks "+" on column headers → selects "Relation" from property type list
2. A config panel appears with a search field: "Select a database"
3. The search queries all `affine:database` blocks in the current workspace
4. User clicks a database → the relation is configured
5. The column appears with the selected database name as default column name

**Finding all databases in the workspace:**

```typescript
function findAllDatabases(store: BlockStore): { id: string; title: string }[] {
  const result: { id: string; title: string }[] = [];
  // Walk the workspace's block tree, collect all affine:database blocks
  store.workspace.docs.forEach(doc => {
    doc.getBlocksByFlavour('affine:database').forEach(block => {
      const model = block.model as DatabaseBlockModel;
      result.push({
        id: model.id,
        title: model.props.title?.toString() ?? 'Untitled',
      });
    });
  });
  return result;
}
```

### Task 1.4 — Register the Property

**Where:**

- `blocksuite/affine/data-view/src/property-presets/index.ts` — export the new config
- `blocksuite/affine/blocks/database/src/properties/index.ts` — add to `databaseBlockProperties`

```typescript
// In databaseBlockProperties:
export const databaseBlockProperties = {
  // ... existing properties ...
  relationColumnConfig: relationPropertyConfig,
};
```

### Task 1.5 — Wire Up Cell Value Resolution in DataSource

**Where:** `blocksuite/affine/blocks/database/src/data-source.ts`

The `cellValueGet` method needs to handle relation values by resolving row IDs to displayable data. The raw value stays as `string[]` (row IDs), but the renderer uses the resolution helper from Task 1.2.

No changes to `cellValueGet` itself — the resolution happens in the renderer, not the data source. The data source just stores/retrieves the array of IDs.

### Edge Cases — Phase 1

| Edge Case                                                | Handling                                                                                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Target database deleted**                              | Cell renderer shows "(Database deleted)" for the relation column. The column config still holds the `targetDatabaseId` but resolution returns null. User should be prompted to reconfigure or delete the column. |
| **Referenced row deleted**                               | Cell value may contain stale IDs. The renderer must filter out IDs that no longer resolve to a block. Show "(deleted)" chip briefly, then auto-clean the ID from the array on next save.                         |
| **Target database on a different page (same workspace)** | Works — block IDs are workspace-global. The `store.getBlock()` call works across pages within the same workspace.                                                                                                |
| **User lacks permission to view target database**        | In AFFiNE's current auth model, workspace-level permissions mean if you can access the workspace, you can access all databases in it. No additional checks needed for single-workspace scope.                    |
| **Circular references (A relates to B, B relates to A)** | Each relation is independent. A→B and B→A are two separate one-way relation columns. No circular dependency in data — only in UX navigation.                                                                     |
| **Large databases (1000+ rows in picker)**               | The row picker should use virtualized scrolling and debounced search. Initial implementation can load all rows; optimize later.                                                                                  |
| **Empty target database**                                | Picker shows "No rows" state. User can still configure the relation, they just can't link anything yet.                                                                                                          |

---

## Phase 2: Bidirectional Relations

### Goal

When creating a relation from Database A → Database B, optionally auto-create a reverse relation column in Database B that shows which rows in A link to each row in B.

### Task 2.1 — Bidirectional Toggle in Config Panel

**What:** Add a toggle to the relation configuration panel: "Show on [Target Database]" (default: ON).

When ON:

1. Create the relation column in Database A as before
2. Automatically add a reverse relation column in Database B with:
   - `targetDatabaseId` = Database A's block ID
   - `isReverse` = true
   - `reversePropertyId` = the property ID of the column in Database A

### Task 2.2 — Sync Logic for Bidirectional Relations

**What:** When a user links Row X (in DB-A) to Row Y (in DB-B) via the relation cell:

1. Update DB-A's cell: `cells[rowX][relationColId] = [...existing, rowY]`
2. If bidirectional: Update DB-B's cell: `cells[rowY][reverseColId] = [...existing, rowX]`

Both operations happen in the same Yjs transaction:

```typescript
store.transact(() => {
  // Update forward relation
  updateCell(dbAModel, rowXId, { columnId: forwardColId, value: [...forwardValue, rowYId] });
  // Update reverse relation
  if (reverseColId) {
    updateCell(dbBModel, rowYId, { columnId: reverseColId, value: [...reverseValue, rowXId] });
  }
});
```

**Why same transaction matters:** Yjs transactions are atomic. If the user is offline and makes changes, the CRDT merge will apply both updates together, maintaining consistency.

### Task 2.3 — Unlink Sync

When a user removes a link (unlinking Row Y from Row X):

1. Remove `rowY` from DB-A's cell
2. If bidirectional: Remove `rowX` from DB-B's reverse cell

Same transactional approach.

### Edge Cases — Phase 2

| Edge Case                                                                         | Handling                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Delete the forward relation column**                                            | Must also delete the reverse column in the target database. Show a warning: "This will also remove the related column in [Target DB]." Wrap in a single transaction.                                                                        |
| **Delete the reverse column only**                                                | Convert the forward column to one-way (set `reversePropertyId = null`). Don't delete the forward column.                                                                                                                                    |
| **Two users simultaneously linking different rows**                               | CRDT merges arrays. If User 1 adds `rowY` and User 2 adds `rowZ` concurrently, the merged result is `[rowY, rowZ]`. Yjs handles this correctly for Y.Array operations.                                                                      |
| **User 1 links while User 2 deletes the target row**                              | After merge, the cell contains a stale ID. The renderer filters it out (same as Phase 1 edge case).                                                                                                                                         |
| **Bidirectional self-reference**                                                  | Database A relates to itself. Both forward and reverse columns are in the same database. Works identically — the `targetDatabaseId` equals the current database's ID. Two columns: e.g., "Sub-tasks" (forward) and "Parent Task" (reverse). |
| **Multiple bidirectional relations to same DB**                                   | Each pair has distinct `propertyId` and `reversePropertyId`. They don't interfere.                                                                                                                                                          |
| **Offline user creates a relation, another user deletes the target DB meanwhile** | On sync, the relation column persists but the `targetDatabaseId` resolves to null. The renderer shows a broken state. User must delete or reconfigure the column.                                                                           |

---

## Phase 3: Rollup Property Type

### Goal

Allow a column to aggregate data from rows linked via a relation column. E.g., "Total Hours" = SUM of the "Hours" column from all related rows.

### Task 3.1 — Define the Rollup Property Model

**Where:** New directory: `blocksuite/affine/data-view/src/property-presets/rollup/`

**Data Model:**

```typescript
export const RollupPropertySchema = zod.object({
  // Which relation column to roll up from
  relationPropertyId: zod.string(),
  // Which property in the target database to aggregate
  targetPropertyId: zod.string(),
  // Aggregation function
  calculation: zod.enum(['show_original', 'count_all', 'count_values', 'count_unique', 'count_empty', 'count_not_empty', 'percent_empty', 'percent_not_empty', 'sum', 'average', 'median', 'min', 'max', 'earliest', 'latest']),
});
```

### Task 3.2 — Rollup Cell Computation

Rollup cells are **read-only computed values**. The cell value is derived at render time, not stored:

```typescript
function computeRollup(sourceDataSource: DatabaseBlockDataSource, rowId: string, rollupConfig: RollupPropertyData): unknown {
  // 1. Get the relation cell value (array of target row IDs)
  const relatedRowIds = (sourceDataSource.cellValueGet(rowId, rollupConfig.relationPropertyId) as string[]) ?? [];

  // 2. Get the target database's data source
  const targetDb = store.getBlock(targetDatabaseId)?.model as DatabaseBlockModel;
  const targetDataSource = new DatabaseBlockDataSource(targetDb);

  // 3. Collect values from the target property for each related row
  const values = relatedRowIds.map(id => targetDataSource.cellValueGet(id, rollupConfig.targetPropertyId)).filter(v => v !== undefined);

  // 4. Apply the calculation
  return applyCalculation(rollupConfig.calculation, values);
}
```

### Task 3.3 — Rollup Configuration Panel

Flow:

1. User adds a Rollup property
2. Step 1: Select a relation column from THIS database (dropdown of existing relation columns)
3. Step 2: Select a property from the TARGET database (populated based on which DB the relation points to)
4. Step 3: Choose a calculation function

### Edge Cases — Phase 3

| Edge Case                                                      | Handling                                                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Relation column deleted that a rollup depends on**           | Rollup shows an error state: "Missing relation." User must reconfigure or delete the rollup.                                                       |
| **Target property type mismatch** (e.g., SUM on a text column) | Only show compatible calculations for the selected property type. Number/Progress → all math ops. Date → earliest/latest. Text → count-based only. |
| **Performance with many related rows**                         | Lazy compute — only calculate when the cell is visible. Cache results with a signal that invalidates when the relation or target data changes.     |
| **Rollup of a rollup**                                         | Not supported initially. The target property picker should exclude rollup-type properties to prevent recursive computation chains.                 |
| **No relation columns exist yet**                              | Show a helpful message: "Add a Relation column first before creating a Rollup."                                                                    |

---

## Phase 4: Linked Database Views

### Goal

Allow users to embed a view of an existing database on a different page, with independent filter/sort settings but shared underlying data.

### Task 4.1 — Linked Database Block Model

**What:** Create a new block type `affine:linked-database` that references an existing `affine:database` block.

```typescript
// New block schema
type LinkedDatabaseBlockProps = {
  // Block ID of the source database
  sourceDatabaseId: string;
  // Independent view configurations for this linked instance
  views: ViewBasicDataType[];
};
```

This block does NOT store `cells`, `columns`, or `title` — it delegates to the source database for all data.

### Task 4.2 — Linked Database Data Source

**What:** A new `LinkedDatabaseBlockDataSource` that wraps the source database's data:

```typescript
class LinkedDatabaseBlockDataSource extends DataSourceBase {
  private sourceDataSource: DatabaseBlockDataSource;

  constructor(linkedModel: LinkedDatabaseBlockModel) {
    super();
    const sourceDb = store.getBlock(linkedModel.props.sourceDatabaseId)?.model;
    this.sourceDataSource = new DatabaseBlockDataSource(sourceDb);
  }

  // Delegate all data operations to source
  get rows$() {
    return this.sourceDataSource.rows$;
  }
  cellValueGet(rowId, propId) {
    return this.sourceDataSource.cellValueGet(rowId, propId);
  }
  cellValueChange(rowId, propId, value) {
    this.sourceDataSource.cellValueChange(rowId, propId, value);
  }

  // But views are LOCAL to this linked instance
  get viewDataList$() {
    return computed(() => this.linkedModel.props.views$.value);
  }
  viewDataAdd(viewData) {
    /* write to linked model, not source */
  }
}
```

### Task 4.3 — Slash Command Integration

**What:** Register a `/linked view of database` slash command (or `/linked database`).

**Flow:**

1. User types `/linked`
2. See option: "Linked view of database"
3. Click → search modal showing all databases in the workspace
4. Select a database → `affine:linked-database` block is inserted
5. Default view type = table (or match the source's first view)

### Task 4.4 — Data Source Header

The linked database block renders a small header: "↗ [Source Database Name]" that links to the original database. This tells the user they're looking at a linked view, not the original.

### Edge Cases — Phase 4

| Edge Case                                      | Handling                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Source database deleted**                    | Linked view shows error: "Source database was deleted." Block can be deleted by user.                                                                                                                                                                              |
| **Row added in linked view**                   | Row is added to the SOURCE database (via delegated data source). If the linked view has filters, the new row may immediately disappear from view if it doesn't match. Show a toast: "Row added to [Source DB Name]. It may not appear here due to active filters." |
| **Filters hide all rows**                      | Show empty state: "No rows match the current filters." with a "Clear filters" button.                                                                                                                                                                              |
| **Multiple linked views of the same database** | Each is an independent `affine:linked-database` block with its own view config. All share the same data. Edits in any of them propagate to all.                                                                                                                    |
| **Source database on a different page**        | Works — block IDs are workspace-global. The data source resolves via `store.getBlock()`.                                                                                                                                                                           |
| **Rename source database**                     | The linked view's header updates automatically (reads title from source via signal).                                                                                                                                                                               |

---

## Phase 5: Additional View Types

### Goal

Add Gallery, List, Calendar, and Timeline views to match Notion's offerings.

### Task 5.1 — View Registration Pattern

Each new view follows the existing pattern in `blocksuite/affine/data-view/src/view-presets/`:

```typescript
// Example: calendar view
export const calendarViewModel = viewType('calendar').createModel({
  defaultName: 'Calendar View',
  dataViewManager: CalendarSingleView,
  defaultData: viewManager => ({
    // Calendar-specific config
    datePropertyId: '', // which date column to use for positioning
    columns: [],
    filter: { type: 'group', op: 'and', conditions: [] },
    sort: [],
  }),
});
```

Then register in `blocksuite/affine/blocks/database/src/views/index.ts`:

```typescript
export const databaseBlockViews: ViewMeta[] = [viewPresets.tableViewMeta, viewPresets.kanbanViewMeta, galleryViewMeta, listViewMeta, calendarViewMeta, timelineViewMeta];
```

### Task 5.2 — View Implementations

| View              | Complexity | Key Requirements                                                                                                                                 |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **List View**     | 🟢 Low     | Like a table but each row is a single-line item with title + a few properties. Minimal rendering logic.                                          |
| **Gallery View**  | 🟡 Medium  | Card grid layout. Needs a "cover image" property selector. Cards show title + selected preview properties.                                       |
| **Calendar View** | 🟡 Medium  | Month/week grid. Requires a date property to be selected. Items placed based on date value. Drag to reschedule.                                  |
| **Timeline View** | 🔴 Hard    | Gantt-like horizontal bars. Requires start date + end date properties. Scroll, zoom, dependency lines. Consider using an existing Gantt library. |

### Edge Cases — Phase 5

| Edge Case                               | Handling                                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calendar view with no date property** | Prompt user to select or create a date property. Block the view creation until done.                                                              |
| **Timeline view with only one date**    | Use the single date as both start and end (point event). Or require two date properties.                                                          |
| **Gallery view with no image property** | Cards render without images — just title + text properties. Not an error.                                                                         |
| **Switch between views**                | All views share the same rows. Only presentation changes. View-specific configs (which properties are visible, sort, filter) are stored per view. |

---

## Phase 6: Multi-View Tab Bar Enhancement

### Goal

Make the view tab bar a first-class UX element: named tabs, right-click context menu, unlimited views.

### Task 6.1 — Tab Bar UX

Current state: AFFiNE has a basic view switcher. Enhance to:

1. Show all views as named tabs: `[Table 1] [Kanban] [Calendar] [+]`
2. Click "+" → dropdown with view type options + name field
3. Right-click tab → Rename, Duplicate, Delete, Copy link
4. Drag tabs to reorder
5. At least one view must always exist (disable delete on last view)

### Task 6.2 — Per-View Filter/Sort Independence

Each view already has its own data in `ViewBasicDataType`. Ensure that when a user adds a filter or sort on one view tab, it does NOT affect other view tabs of the same database.

The current architecture stores views as an array in `DatabaseBlockProps.views`. Each view entry should contain its own `filter`, `sort`, and `visibleColumns` config. Verify this is fully independent.

---

## Edge Case Master List

This section consolidates all edge cases across all phases, organized by category.

### Data Integrity

| #   | Edge Case                                               | Phase | Resolution                                                                     |
| --- | ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------ |
| 1   | Target database deleted while relation column exists    | 1     | Show "(Database deleted)" in column header. Offer to delete the broken column. |
| 2   | Referenced row deleted while relation cell points to it | 1     | Filter stale IDs from cell value on render. Auto-clean on next write.          |
| 3   | Bidirectional: delete forward column                    | 2     | Also delete reverse column in target DB. Single transaction. Warning dialog.   |
| 4   | Bidirectional: delete reverse column only               | 2     | Convert forward column to one-way. Set `reversePropertyId = null`.             |
| 5   | Rollup depends on a relation that gets deleted          | 3     | Rollup shows error state. User must reconfigure.                               |
| 6   | Source database of linked view deleted                  | 4     | Linked view block shows error. User deletes the block.                         |

### Concurrency (CRDT/Offline)

| #   | Edge Case                                                             | Phase | Resolution                                                             |
| --- | --------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| 7   | Two users link different rows to the same cell concurrently           | 2     | Yjs merges both additions into the array. Both links preserved.        |
| 8   | User 1 links a row, User 2 deletes that row, both offline             | 2     | After sync, stale ID in cell. Renderer filters it. Eventually cleaned. |
| 9   | User 1 creates a bidirectional relation, User 2 deletes the target DB | 2     | After sync, column exists but target is gone. Same as edge case #1.    |
| 10  | Row added in linked view while another user changes the filter        | 4     | Row is added to source DB. Filter may hide it. Toast notification.     |

### UX / Validation

| #   | Edge Case                                | Phase | Resolution                                                                 |
| --- | ---------------------------------------- | ----- | -------------------------------------------------------------------------- |
| 11  | Self-referencing relation (DB to itself) | 2     | Fully supported. Forward + reverse columns both in same DB.                |
| 12  | Multiple relations from DB-A to DB-B     | 1     | Each column independent. Different `propertyId`, same `targetDatabaseId`.  |
| 13  | Rollup on a non-numeric column with SUM  | 3     | Only show compatible calculations in the config dropdown.                  |
| 14  | Calendar view without a date column      | 5     | Force user to select/create a date property before view renders.           |
| 15  | Delete the last view in a database       | 6     | Prevent deletion. Show tooltip: "Cannot delete the last view."             |
| 16  | Duplicate view names                     | 6     | Allowed but append "(2)" for auto-generated duplicates.                    |
| 17  | Relation picker with 10,000+ rows        | 1     | Virtualized list + debounced search. Load first 100, paginate on scroll.   |
| 18  | Rollup of a rollup (recursive)           | 3     | Disallow. Hide rollup properties from the rollup's target property picker. |

### Migration / Compatibility

| #   | Edge Case                                                     | Phase | Resolution                                                                                                                                                                    |
| --- | ------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | Existing databases need schema migration for relation support | 1     | No migration needed. Relations are additive — new column type, new cell values. Existing data unchanged.                                                                      |
| 20  | Old client opens a workspace with relation columns            | 1     | Old client sees an unknown column type. Should render as "(Unsupported property type)". The data-view framework's `propertyMetaGet` returns undefined for unregistered types. |

---

## Affected Files Summary

| File                                                             | Change Type | Phase | Reason                                                |
| ---------------------------------------------------------------- | ----------- | ----- | ----------------------------------------------------- |
| `blocksuite/affine/data-view/src/property-presets/relation/`     | Create      | 1     | New property type: define, cell-renderer              |
| `blocksuite/affine/data-view/src/property-presets/rollup/`       | Create      | 3     | New property type: define, cell-renderer              |
| `blocksuite/affine/data-view/src/property-presets/index.ts`      | Modify      | 1, 3  | Export new property configs                           |
| `blocksuite/affine/data-view/src/property-presets/pure-index.ts` | Modify      | 1, 3  | Export new property models                            |
| `blocksuite/affine/data-view/src/property-presets/effect.ts`     | Modify      | 1, 3  | Register cell renderer effects                        |
| `blocksuite/affine/blocks/database/src/properties/index.ts`      | Modify      | 1, 3  | Add to `databaseBlockProperties`                      |
| `blocksuite/affine/blocks/database/src/data-source.ts`           | Modify      | 1, 2  | Handle relation cell resolution, bidirectional sync   |
| `blocksuite/affine/model/src/blocks/database/types.ts`           | Modify      | 1     | Add RelationCellData type (optional, for type safety) |
| `blocksuite/affine/data-view/src/view-presets/`                  | Create      | 5     | New view types: gallery, list, calendar, timeline     |
| `blocksuite/affine/data-view/src/view-presets/index.ts`          | Modify      | 5     | Export new view metas                                 |
| `blocksuite/affine/blocks/database/src/views/index.ts`           | Modify      | 5     | Register new views in `databaseBlockViews`            |
| `blocksuite/affine/model/src/blocks/`                            | Create      | 4     | New `linked-database` block model                     |
| `blocksuite/affine/blocks/`                                      | Create      | 4     | New `linked-database` block implementation            |
| `packages/frontend/core/src/blocksuite/database-block/`          | Modify      | 1-6   | Frontend integration for new components               |

---

## Success Criteria

The implementation is complete when:

- [x] Users can add a Relation column and link rows from another database in the same workspace
- [x] Bidirectional relations auto-create reverse columns and stay in sync
- [x] Self-referencing relations work (a database relating to itself)
- [x] Deleting related rows/columns/databases produces graceful degradation, not crashes
- [x] Rollup columns compute correct aggregations from related data
- [ ] Linked database views can be embedded on any page with independent filters/sorts
- [ ] Data edits in linked views propagate to the source database
- [ ] At least Gallery, List, and Calendar views are functional alongside Table and Kanban
- [ ] Concurrent offline edits to relation cells merge correctly via CRDT
- [ ] Existing databases (without relations) continue to work without migration

---

## Risks & Open Questions

1. **Yjs array merge behavior for relation cells.** When two users concurrently modify the same relation cell (adding different links), Yjs will merge both additions. However, if both users _remove_ different items, the merge semantics might not be intuitive. Need to verify with Yjs array splice behavior.

2. **Performance of cross-page block resolution.** `store.getBlock(id)` across pages in a workspace may require those pages' Yjs documents to be loaded. If a user views a relation column pointing to a database on an unloaded page, we need lazy loading or a lightweight block index.

3. **Rollup recomputation triggers.** When a related row's value changes, all rollups pointing to it need to recompute. This is O(relations × rollups) per change. For large datasets, consider debounced recomputation or a dependency graph.

4. **Linked database and permissions.** Currently moot for single-workspace scope, but if AFFiNE later adds page-level permissions, linked views would need access checks.

5. **Block model version bump.** Adding new block types and property types may require bumping the `DatabaseBlockSchema` version from 3 to 4. Need to verify BlockSuite's migration system.
