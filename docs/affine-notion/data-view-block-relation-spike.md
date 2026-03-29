# Phase E — `affine:data-view` and relations (spike / deferred)

This note records why **full relation/rollup parity** for the `affine:data-view` (workspace query) block is **out of scope** for the table/database unification track.

## Problem

- `affine:database` rows are **child blocks** of the database; relation cells store **row block ids** and resolve titles via `store.getBlock(rowId)`.
- `affine:data-view` uses `BlockQueryDataSource`: rows are **queried blocks** from across the workspace, not owned children of the data-view block.

## Open questions (for a future ADR)

1. Stable row identity for relations when the query set changes.
2. Whether relations from a query view may only target **`affine:database`** rows (cross-type linking).
3. Rollup invalidation when underlying blocks move between docs or no longer match the query.

**Status:** No implementation planned until Phase A–B (table/database) are stable in production.
