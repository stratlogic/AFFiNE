# Post–Phase E follow-ups — implementation plan

> **Last updated:** 2026-03-29  
> **Scope:** Hardening after Phase E (`affine:data-view` relations / `BlockQueryDataSource`), database package hygiene, and deferred Phase D product decisions.  
> **Tracker:** [table_database_unify_task_tracker.md](./table_database_unify_task_tracker.md)  
> **Design reference:** [data-view-block-relation-spike.md](./data-view-block-relation-spike.md)

**Status (engineering):** Workstream **B** (doc-link payload vs `DocLinkClickedEvent`) is **done**. Workstream **A** is **partially done**: Vitest in `@blocksuite/affine-block-data-view` uses `@vanilla-extract/vite-plugin`; import smoke + bidirectional relation sync tests exist; optional **rollup-only** scenario and **decoupling** `viewConverts` from `data-source.ts` remain. Workstream **C** (Phase D) still **product-owned**.

---

## Purpose

Stabilize and verify the table/database unification track after Phase E ships: keep **integration coverage** for `BlockQueryDataSource` honest, maintain **typecheck** and **navigation** invariants for doc links, and execute **Phase D** only after explicit product decisions.

**Out of scope for this plan:** New relation or rollup product features unless they unblock tests or CI.

---

## Success criteria

- **A:** `BlockQueryDataSource` has a **repeatable** test command and coverage for **relation** paths; **rollup** recomputation under Vitest is optional but desirable ([Workstream A](#workstream-a-blockquerydatasource-integration-tests)).
- **B:** `tsc --noEmit -p blocksuite/affine/blocks/database` passes; `docLinkClicked.next` payloads match `ReferenceInfo` (`params.blockIds` where applicable). **Met.**
- **C:** Phase D rows in the unification tracker have **owner, decision, and target** (or stay explicitly deferred).

---

## Context (repo facts)

### Integration tests and vanilla-extract

- [`blocksuite/affine/blocks/data-view/src/data-source.ts`](../../blocksuite/affine/blocks/data-view/src/data-source.ts) still imports `viewConverts` from `@blocksuite/data-view/view-presets` (heavy graph including **vanilla-extract** `*.css.ts`).
- **Without** the package’s Vitest config plugin, importing `BlockQueryDataSource` in tests typically **fails**. **Mitigation in repo:** [`vitest.config.ts`](../../blocksuite/affine/blocks/data-view/vitest.config.ts) in `@blocksuite/affine-block-data-view` adds `@vanilla-extract/vite-plugin`. Run: `yarn workspace @blocksuite/affine-block-data-view test`.
- **Coverage layers:**
  - [`relation-container-data-view.unit.spec.ts`](../../blocksuite/affine/blocks/database/src/__tests__/relation-container-data-view.unit.spec.ts) — mocked `affine:data-view` containers → [`relation-container-cells.ts`](../../blocksuite/affine/blocks/database/src/utils/relation-container-cells.ts).
  - [`block-query-data-source-import.unit.spec.ts`](../../blocksuite/affine/blocks/data-view/src/__tests__/block-query-data-source-import.unit.spec.ts) — module load / class smoke.
  - [`block-query-data-source-relation.unit.spec.ts`](../../blocksuite/affine/blocks/data-view/src/__tests__/block-query-data-source-relation.unit.spec.ts) — `TestWorkspace` + todo query rows + bidirectional relation → reverse cell on target database.

### Doc links and `DocLinkClickedEvent` (resolved)

- [`DocLinkClickedEvent`](../../blocksuite/affine/inlines/reference/src/reference-node/types.ts) is `ReferenceInfo & { openMode?; event?; host }`.
- [`ReferenceInfo`](../../blocksuite/affine/model/src/consts/doc.ts) uses `pageId` and optional `params` (e.g. `params.blockIds`), not a top-level `blockId`.
- **DOM:** [`relation/cell-renderer.ts`](../../blocksuite/affine/data-view/src/property-presets/relation/cell-renderer.ts) may still dispatch `affine-doc-link-clicked` with `detail: { pageId, blockId }` (fine for a `CustomEvent`).
- **Rx:** [`database-block.ts`](../../blocksuite/affine/blocks/database/src/database-block.ts) and [`linked-database-block.ts`](../../blocksuite/affine/blocks/linked-database/src/linked-database-block.ts) bridge to `docLinkClicked.next({ pageId, params: { blockIds: [blockId] }, host })` so **TypeScript and app subscribers** (e.g. share page `jumpToPageBlock`) see `params.blockIds`.

**Subscribers** that only use `pageId` (e.g. [`playground` starter](../../blocksuite/playground/apps/starter/utils/extensions.ts)) remain valid.

### Phase D (product / policy)

From the tracker § Phase D:

| ID  | Task                                                                       |
| --- | -------------------------------------------------------------------------- |
| D.1 | Optional: remove **Simple table** slash after analytics — **product call** |
| D.2 | Auto-prompt migration on doc open — **optional enhancement**               |

These need **owner**, **metrics gate** (D.1), and **UX spec** (D.2), not only engineering tickets.

---

## Workstream A — `BlockQueryDataSource` integration tests

| Step    | Action                                                                                                                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A.1** | Document the import graph: test → `BlockQueryDataSource` → `view-presets` → vanilla-extract `*.css.ts`.                                                                                                                                                                                             |
| **A.2** | Spike and choose one path (prefer lowest coupling first):                                                                                                                                                                                                                                           |
|         | **Decouple** — Move or narrow `viewConverts` (or a minimal subset) so non-UI code in `data-source.ts` does not import the full view-presets graph.                                                                                                                                                  |
|         | **Test harness** — Vitest config (e.g. deps optimizer / SSR / mocks for `.css.ts`); align with existing Blocksuite patterns.                                                                                                                                                                        |
|         | **Layer test** — Playwright or existing E2E for query view + relation (slower, broader).                                                                                                                                                                                                            |
|         | **Contract test** — Extract pure logic (relation cell read/write, rollup epoch invalidation) into a Vitest-safe module; keep thin wiring in `data-source.ts`.                                                                                                                                       |
| **A.3** | Define minimum scenarios: add relation column → link row → reverse column on target DB → change linked cell → rollup recomputes; optionally **orphaned cell keys** per ADR in [data-view-block-relation-spike.md](./data-view-block-relation-spike.md).                                             |
| **A.4** | **Verify:** `pnpm test --run` / `yarn vitest run` with filter for the new spec(s). **Implemented:** `@blocksuite/affine-block-data-view` runs `yarn vitest run` in `blocksuite/affine/blocks/data-view` (config includes `@vanilla-extract/vite-plugin`). Optional rollup-only scenario still open. |

```mermaid
flowchart LR
  VitestSpec[Vitest spec]
  BQDS[BlockQueryDataSource]
  ViewPresets[view-presets]
  VE[vanilla-extract css.ts]
  VitestSpec --> BQDS
  BQDS --> ViewPresets
  ViewPresets --> VE
```

---

## Workstream B — Database package typecheck

| Step    | Action                                                                                                                                                                                                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B.1** | Run `tsc --noEmit -p blocksuite/affine/blocks/database` (or Nx equivalent). Re-run after doc-link changes; record any new failures in an issue.                                                                                                                                               |
| **B.2** | Normalize `affine-doc-link-clicked` detail vs `DocLinkClickedEvent` (see context above).                                                                                                                                                                                                      |
| **B.3** | **Regression:** Subscribers of `RefNodeSlotsProvider.docLinkClicked` still receive a navigable payload; validate playground and app-level handlers. **Done:** `docLinkClicked.next` now passes `params: { blockIds: [...] }` per `ReferenceInfo` (`database-block`, `linked-database-block`). |

---

## Workstream C — Phase D decisions

| Step    | Action                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C.1** | Schedule product decision on **D.1**: analytics threshold, communication for Simple table sunset.                                                                             |
| **C.2** | If **D.2** proceeds: UX (when to prompt, dismiss, “don’t show again”), technical hook on doc open, link to migration path from Phase B (`migrateTableBlockToDatabase`, etc.). |
| **C.3** | Update tracker rows D.1/D.2 with status, owner, target release **after** decisions. **Tracker:** Phase D rows note product-owner / defer and link here until decided.         |

---

## Ordering and dependencies

- **B** is small and reduces merge risk if CI is strict; can run in parallel with **A** spike.
- **C** is parallel to engineering but **blocks** implementation of D.1/D.2 until product signs off.

---

## Risks

| Risk                                                 | Mitigation                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Decoupling view-presets touches many exports         | Time-box spike; prefer keeping VE Vitest plugin in `affine-block-data-view` unless bundle/size requires split. |
| Vitest remains blocked for full `data-source` import | Ensure `@vanilla-extract/vite-plugin` is in that package’s Vitest config; otherwise E2E.                       |
| Changing `docLinkClicked` payload breaks integrators | Coordinate with consumers; prefer mapping at emit site over changing `ReferenceInfo`.                          |

---

## Related files (quick index)

| Area                                       | Path                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `BlockQueryDataSource`                     | `blocksuite/affine/blocks/data-view/src/data-source.ts`                                                       |
| View converts entry                        | `@blocksuite/data-view/view-presets`                                                                          |
| Relation container helpers                 | `blocksuite/affine/blocks/database/src/utils/relation-container-cells.ts`                                     |
| Data-view relation tests (mock containers) | `blocksuite/affine/blocks/database/src/__tests__/relation-container-data-view.unit.spec.ts`                   |
| `BlockQueryDataSource` Vitest (VE)         | `blocksuite/affine/blocks/data-view/src/__tests__/block-query-data-source-*.unit.spec.ts`, `vitest.config.ts` |
| Doc link handler                           | `blocksuite/affine/blocks/database/src/database-block.ts`, `linked-database/src/linked-database-block.ts`     |
