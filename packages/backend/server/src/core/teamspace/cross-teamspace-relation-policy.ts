import { Injectable } from '@nestjs/common';

import { Models, WorkspaceRole } from '../../models';
import { TeamspaceVisibility } from '../../models/teamspace';
import { AccessController } from '../permission';
import { Action } from '../permission/types';

export type CrossTeamspaceRelationCapabilities = {
  canReadRelay: boolean;
  canMutateRelation: boolean;
};

/**
 * Permission matrix for cross-doc / cross-teamspace database relations (one cloud workspace).
 *
 * Source and target pages may live in different teamspaces under the same `workspaceId`.
 *
 * - canReadRelay: workspace Owner/Admin; else Doc.Read on source and target, participation in
 *   both teamspaces (explicit member, or workspace member with Open/Closed visibility), and both
 *   docs assigned to a teamspace in this workspace (not only one).
 * - canMutateRelation: workspace Owner/Admin; else same as relay plus Doc.Update on source.
 */
@Injectable()
export class CrossTeamspaceRelationPolicy {
  constructor(
    private readonly models: Models,
    private readonly ac: AccessController
  ) {}

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

  /** Open/Closed teamspaces are visible to the whole workspace; private teamspaces require a role row. */
  private async participatesInTeamspace(
    teamspaceId: string,
    workspaceId: string,
    userId: string
  ): Promise<boolean> {
    if (await this.models.teamspaceUser.isMember(teamspaceId, userId)) {
      return true;
    }
    const ts = await this.models.teamspace.get(teamspaceId);
    if (!ts || ts.workspaceId !== workspaceId) {
      return false;
    }
    if (ts.visibility === TeamspaceVisibility.Private) {
      return false;
    }
    const wsUser = await this.models.workspaceUser.getActive(
      workspaceId,
      userId
    );
    return wsUser != null;
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

    const [docReadSource, docReadTarget, docUpdateSource] = await Promise.all([
      this.ac.user(userId).doc(workspaceId, sourceDocId).can(Action.Doc.Read),
      this.ac.user(userId).doc(workspaceId, targetDocId).can(Action.Doc.Read),
      this.ac.user(userId).doc(workspaceId, sourceDocId).can(Action.Doc.Update),
    ]);

    const sourceTs = await this.models.teamspaceDoc.findByDocForWorkspace(
      sourceDocId,
      workspaceId
    );
    const targetTs = await this.models.teamspaceDoc.findByDocForWorkspace(
      targetDocId,
      workspaceId
    );

    if (!sourceTs || !targetTs) {
      return { canReadRelay: false, canMutateRelation: false };
    }

    const [participatesSource, participatesTarget] = await Promise.all([
      this.participatesInTeamspace(sourceTs.teamspaceId, workspaceId, userId),
      this.participatesInTeamspace(targetTs.teamspaceId, workspaceId, userId),
    ]);

    const inBothTeamspaces = participatesSource && participatesTarget;
    const canReadDocs = docReadSource && docReadTarget;

    const canReadRelay = inBothTeamspaces && canReadDocs;
    const canMutateRelation =
      inBothTeamspaces && canReadDocs && docUpdateSource;

    return { canReadRelay, canMutateRelation };
  }
}
