import { Injectable } from '@nestjs/common';

import { Models, WorkspaceRole } from '../../models';

export type CrossTeamspaceRelationCapabilities = {
  canReadRelay: boolean;
  canMutateRelation: boolean;
};

/**
 * Permission matrix for cross-doc / cross-teamspace database relations (same workspace).
 *
 * - canReadRelay: workspace Owner/Admin, or any user who may access the source doc (view chips).
 * - canMutateRelation: workspace Owner/Admin, or member of every teamspace that contains
 *   the source and target docs (when both docs are assigned to teamspaces), and may access both docs.
 */
@Injectable()
export class CrossTeamspaceRelationPolicy {
  constructor(private readonly models: Models) {}

  private async workspaceRole(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceRole | null> {
    const row = await this.models.workspaceUser.getActive(workspaceId, userId);
    return (row?.type as WorkspaceRole) ?? null;
  }

  private isWorkspaceOwnerOrAdmin(role: WorkspaceRole | null): boolean {
    return role === WorkspaceRole.Owner || role === WorkspaceRole.Admin;
  }

  async evaluate(
    workspaceId: string,
    userId: string,
    sourceDocId: string,
    targetDocId: string
  ): Promise<CrossTeamspaceRelationCapabilities> {
    const wsRole = await this.workspaceRole(workspaceId, userId);
    const wsAdmin = this.isWorkspaceOwnerOrAdmin(wsRole);

    if (wsAdmin) {
      return { canReadRelay: true, canMutateRelation: true };
    }

    const canAccessSource = await this.models.teamspaceDoc.canUserAccessDoc(
      userId,
      sourceDocId,
      false
    );
    const canAccessTarget = await this.models.teamspaceDoc.canUserAccessDoc(
      userId,
      targetDocId,
      false
    );

    const canReadRelay = canAccessSource;

    if (!canAccessSource || !canAccessTarget) {
      return { canReadRelay, canMutateRelation: false };
    }

    const sourceTs = await this.models.teamspaceDoc.findByDoc(sourceDocId);
    const targetTs = await this.models.teamspaceDoc.findByDoc(targetDocId);

    if (!sourceTs || !targetTs) {
      // Unassigned docs are only reachable by WS Owner/Admin (handled above).
      return { canReadRelay, canMutateRelation: false };
    }

    const memberSource = await this.models.teamspaceUser.isMember(
      sourceTs.teamspaceId,
      userId
    );
    const memberTarget = await this.models.teamspaceUser.isMember(
      targetTs.teamspaceId,
      userId
    );

    const canMutateRelation = memberSource && memberTarget;

    return { canReadRelay, canMutateRelation };
  }
}
