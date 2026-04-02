# ADR: Cross-workspace database relation relay

## Status

Proposed / partial implementation (schema + UI guard + server flag).

## Context

Workspace-scoped CRDT graphs cannot safely enforce “User B may read cells sourced from Workspace 2 while editing in Workspace 1 without Workspace 2 membership” using Yjs alone. Internal planning (`docs/affine-notion/database-relation-plan.md`) intentionally limited relations to a single workspace.

## Decision

1. **Server-mediated relay** is the source of truth for cross-workspace projected values when we need strict authorization and minimal payloads.
2. **Opt-in** via environment variable `AFFINE_CROSS_WORKSPACE_RELATION_RELAY=true` (see `packages/backend/server/src/env.ts` and GraphQL query `crossWorkspaceRelationRelayEnabled`).
3. **Client feature flag** `enable_cross_workspace_relation` is synced into Blocksuite (`BlockSuiteFlags`) from Affine experimental settings (canary) so cross-workspace relation UX stays off unless explicitly enabled.
4. **Client data model** extends the relation property with optional `crossWorkspaceTargetWorkspaceId` and `crossWorkspaceRelayReadOnly` (`blocksuite/affine/data-view/src/property-presets/relation/define.ts`). Read-only / locked settings apply only when the flag is on and relay metadata is present (`isCrossWorkspaceRelayColumnUx` in `cell-renderer.ts`).
5. Full relay (resolve mutations, scoped read API, revocation) is **not** implemented in this iteration; this ADR anchors the architecture for follow-up work.

## Consequences

- No leakage of arbitrary Workspace 2 documents; future APIs must whitelist row/column projections.
- Editors must set relay metadata explicitly or via a future server workflow; until then, same-workspace relations behave unchanged.
