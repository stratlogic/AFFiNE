# Table ↔ Database unification — Task tracker

> **Source plan:** `.cursor/plans/unify_table_with_database_2b02f92b.plan.md` (do not edit when executing)
> **Last Updated:** 2026-03-29
> **Status:** ⬜ Not Started · 🔵 In Progress · ✅ Done · ⛔ Blocked

---

## Decision log (Phase 0)

| Decision                                | Choice              | Notes                                                                                                                                            |
| --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sunset vs legacy insert (**D-a / D-b**) | **D-b insert path** | Primary **Table** creates `affine:database`; **Simple table** retains `affine:table`. Strict removal of schema is out of scope for this rollout. |
| Merged / irregular cells                | **Not applicable**  | `affine:table` model has no merged cells; no extra validation required.                                                                          |
| Feature flags                           | **None for v1**     | Slash/keyboard switch ships direct; add flags later if product requires rollback.                                                                |

---

## Handoff — first execution PR

1. From repo root: `pnpm test --run` (or `yarn test --run`).
2. If touching database/table: include `blocksuite/affine/blocks/database/src/__tests__/` and `blocksuite/affine/blocks/linked-database/src/__tests__/`.
3. Typecheck affected packages (Nx or `tsc -b` per workspace convention).

**Execution gate:** No feature work before this tracker exists and decisions above are accepted.

---

## Phase A — Primary "Table" = database insert

| ID  | Task                                                                                        | Status | Primary files                                              | Depends | Verify                                               | Regression check                            |
| --- | ------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------- | ------- | ---------------------------------------------------- | ------------------------------------------- |
| A.1 | Slash **Table** inserts `affine:database` + table view (reuse `insertDatabaseBlockCommand`) | ✅     | `blocksuite/affine/blocks/table/src/configs/slash-menu.ts` | —       | Slash: Table creates DB; telemetry `affine:database` | Existing DB slash tests / manual Table View |
| A.2 | Optional **Simple table** slash entry (`affine:table`)                                      | ✅     | `table/src/configs/slash-menu.ts`                          | A.1     | Second menu item creates `affine:table`              | Adapter tests for `affine:table`            |
| A.3 | Keyboard toolbar **Table** uses database insert                                             | ✅     | `blocksuite/affine/widgets/keyboard-toolbar/src/config.ts` | A.1     | Toolbar inserts DB                                   | —                                           |
| A.4 | Add `@blocksuite/affine-block-database` to table package                                    | ✅     | `blocksuite/affine/blocks/table/package.json`              | —       | `tsc` clean                                          | —                                           |

---

## Phase B — Migrate `affine:table` → `affine:database`

| ID  | Task                                                | Status | Primary files                                                                    | Depends | Verify                        | Regression check                          |
| --- | --------------------------------------------------- | ------ | -------------------------------------------------------------------------------- | ------- | ----------------------------- | ----------------------------------------- |
| B.1 | `migrateTableBlockToDatabase` (+ view columns sync) | ✅     | `blocksuite/affine/blocks/database/src/migration/table-to-database.ts`           | —       | Unit test                     | `relation-sync.unit.spec.ts` still passes |
| B.2 | Vitest migration test (TestWorkspace)               | ✅     | `blocksuite/affine/blocks/database/src/__tests__/table-to-database.unit.spec.ts` | B.1     | `pnpm test --run` filter file | —                                         |
| B.3 | Table block upgrade banner + button                 | ✅     | `blocksuite/affine/blocks/table/src/table-block.ts`, `table-block-css` or inline | B.1     | Manual: upgrade converts      | —                                         |

---

## Phase C — Docs / ecosystem

| ID  | Task                                                      | Status | Primary files                          | Depends | Verify      | Regression check                     |
| --- | --------------------------------------------------------- | ------ | -------------------------------------- | ------- | ----------- | ------------------------------------ |
| C.1 | User guide mention: Table vs database vs simple table     | ✅     | `docs/user-feature-guide-databases.md` | A1,B1   | Doc read    | —                                    |
| C.2 | Reader / search / AI unchanged for `affine:table` flavour | ✅     | N/A (no code removal)                  | —       | Existing CI | `packages/common/reader` if modified |

---

## Phase D — Cleanup (deferred policy)

| ID  | Task                                                    | Status | Notes                |
| --- | ------------------------------------------------------- | ------ | -------------------- |
| D.1 | Optional: remove **Simple table** slash after analytics | ⬜     | Product call         |
| D.2 | Auto-prompt migration on doc open                       | ⬜     | Optional enhancement |

---

## Phase E — `affine:data-view` spike

| ID  | Task                                          | Status | Notes                                                                    |
| --- | --------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| E.1 | ADR: query rows vs database rows for relation | ✅     | [data-view-block-relation-spike.md](./data-view-block-relation-spike.md) |

---

## Progress summary

| Phase | Total | Done |
| ----- | ----- | ---- |
| A     | 4     | 4    |
| B     | 3     | 3    |
| C     | 2     | 2    |
| D     | 2     | 0    |
| E     | 1     | 1    |
