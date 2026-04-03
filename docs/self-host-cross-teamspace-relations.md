# Self-hosted: cross-teamspace database relations

Cross-teamspace / cross-page **relation** columns resolve row labels through the AFFiNE **GraphQL server** (document snapshots). This checklist helps operators and users enable the feature on self-hosted deployments.

## Prerequisites (Phase 1)

1. **Server-backed workspace** — Open the workspace connected to your self-hosted server (sync enabled). Fully offline-only workspaces do not call the resolve APIs.
2. **PostgreSQL + sync + GraphQL** — Run the official AFFiNE server stack so document snapshots exist for target pages.
3. **Environment** — Do **not** disable the feature unless intended:
   - `AFFINE_CROSS_TEAMSPACE_RELATION` — omit or any value except `false` (opt-out disables server relay; see server `env.ts`).
4. **Teamspaces** — Docs should be assigned to teamspaces as required by your permission model; workspace Owner/Admin bypass applies per server policy.
5. **Column configuration** — The relation column must reference another **page** (`targetDocId` set when choosing a database outside the current doc). Same-doc relations stay fully local and do not use the relay API.

## Verification

- Query GraphQL field `crossTeamspaceRelationEnabled` — expect `true` unless the server opted out.
- After sync, confirm target pages have snapshots (row titles resolve from snapshots).

## Client feature flag

- Workspace setting **Cross-teamspace database relations (experimental)** (`enable_cross_teamspace_relation`) must be **on** for the BlockSuite path that lists databases across pages and calls relay APIs.
- On **self-hosted** web builds (`environment.isSelfHosted`), the flag is **configurable in Settings** even on stable channels.
- If the server reports relay **disabled**, the client forces the BlockSuite flag **off** regardless of the saved preference (server is authoritative for availability).

## Related code

- Server: `packages/backend/server/src/core/teamspace/cross-teamspace-relation.resolver.ts`
- Policy: `packages/backend/server/src/core/teamspace/cross-teamspace-relation-policy.ts`
- Client bridge: `packages/frontend/core/src/modules/teamspace/services/teamspace.ts`
