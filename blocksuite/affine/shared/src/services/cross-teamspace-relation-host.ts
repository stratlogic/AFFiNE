import { type Store, StoreExtension } from '@blocksuite/store';

export type RelationCapabilities = {
  canReadRelay: boolean;
  canMutateRelation: boolean;
};

export type ResolvedRelationRow = {
  rowId: string;
  title: string;
  exists: boolean;
};

/** Wired on AFFiNE `WorkspaceImpl` as optional `teamspaceService`. */
export type TeamspaceRelationBridge = {
  hasCloudBackend(): boolean;
  crossTeamspaceRelationCapabilities(
    workspaceId: string,
    sourceDocId: string,
    targetDocId: string
  ): Promise<RelationCapabilities>;
  crossTeamspaceRelationRows(
    workspaceId: string,
    sourceDocId: string,
    targetDocId: string,
    databaseBlockId: string,
    rowIds: string[]
  ): Promise<ResolvedRelationRow[]>;
};

function getBridge(store: Store): TeamspaceRelationBridge | undefined {
  const ws = store.workspace as unknown as { teamspaceService?: TeamspaceRelationBridge };
  return ws.teamspaceService;
}

/**
 * Server-mediated cross-doc relation resolve; requires `workspace.teamspaceService` (AFFiNE cloud).
 */
export class CrossTeamspaceRelationHostService extends StoreExtension {
  static override key = 'cross-teamspace-relation-host';

  isActive(): boolean {
    const bridge = getBridge(this.store);
    return !!bridge?.hasCloudBackend();
  }

  async getCapabilities(
    sourceDocId: string,
    targetDocId: string
  ): Promise<RelationCapabilities> {
    const bridge = getBridge(this.store);
    if (!bridge?.hasCloudBackend()) {
      return { canReadRelay: false, canMutateRelation: false };
    }
    return bridge.crossTeamspaceRelationCapabilities(
      this.store.workspace.id,
      sourceDocId,
      targetDocId
    );
  }

  async resolveRows(
    sourceDocId: string,
    targetDocId: string,
    databaseBlockId: string,
    rowIds: string[]
  ): Promise<ResolvedRelationRow[]> {
    const bridge = getBridge(this.store);
    if (!bridge?.hasCloudBackend()) {
      return [];
    }
    return bridge.crossTeamspaceRelationRows(
      this.store.workspace.id,
      sourceDocId,
      targetDocId,
      databaseBlockId,
      rowIds
    );
  }
}
