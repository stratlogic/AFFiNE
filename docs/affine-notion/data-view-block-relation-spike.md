# Phase E — `affine:data-view` and relations

> **Last updated:** 2026-03-29

This note captures the **design gap** between database rows and **workspace query** rows, the **ADR** for v1, and where the behavior is implemented.

## Problem (why this is not identical to `affine:database`)

- `affine:database` rows are **child blocks** of the database; relation cells store **row block ids** and resolve titles via `store.getBlock(rowId)`.
- `affine:data-view` uses `BlockQueryDataSource`: rows are **queried blocks** from across the workspace, not owned children of the data-view block.

## ADR (locked 2026-03-29) — Phase E v1

| Decision                                  | Resolution                                                                                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row identity / query membership           | **(a)** Block ids remain stable; relation cell values stay in `affine:data-view` `props.cells` even when a block temporarily falls out of the query. Only current query rows are shown; orphaned cell keys are allowed.                                              |
| Relation targets                          | **Database rows only** for links from `affine:data-view` (same picker as `affine:database`). Picking query-only blocks from a database row picker stays out of scope for v1.                                                                                         |
| Bidirectional (`Separate back-reference`) | **Supported** when enabled: reverse column lives on the target database; `targetDatabaseId` on the reverse column may reference an `affine:data-view` block id. Sync uses workspace-aware read/write for both `affine:database` and `affine:data-view` cell storage. |
| Rollup                                    | Allowed on query views; rollup reads related **database** rows via the relation column. `BlockQueryDataSource` bumps a refresh epoch on workspace `blockUpdated` so rollup cells recompute when linked data changes.                                                 |

## Implementation (code map)

| Area                                                   | Location                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Query column presets (relation + rollup)               | `blocksuite/affine/blocks/data-view/src/columns/index.ts`                                                                                       |
| `BlockQueryDataSource` (cells, relation sync, rollup)  | `blocksuite/affine/blocks/data-view/src/data-source.ts`                                                                                         |
| Read/write relation values on DB or data-view models   | `blocksuite/affine/blocks/database/src/utils/relation-container-cells.ts`                                                                       |
| Database relation `cellValueChange` / reverse detach   | `blocksuite/affine/blocks/database/src/data-source.ts`                                                                                          |
| Relation UI note for query-backed data sources         | `blocksuite/affine/data-view/src/property-presets/relation/cell-renderer.ts`                                                                    |
| Unit tests (mock data-view cells)                      | `blocksuite/affine/blocks/database/src/__tests__/relation-container-data-view.unit.spec.ts`                                                     |
| Vitest integration (`BlockQueryDataSource`, VE plugin) | `blocksuite/affine/blocks/data-view/src/__tests__/block-query-data-source-import.unit.spec.ts`, `block-query-data-source-relation.unit.spec.ts` |

**Tracker:** [table_database_unify_task_tracker.md](./table_database_unify_task_tracker.md) — Phase E (E.1–E.6) complete.

**Post–Phase E hardening:** [implementation_plan.md](./implementation_plan.md) (doc-link `ReferenceInfo` alignment, optional rollup Vitest, Phase D).

**Status:** Implemented; verify with commands in the unification tracker handoff section.
