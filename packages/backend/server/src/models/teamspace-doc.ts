import { Injectable } from '@nestjs/common';

import { BaseModel } from './base';

@Injectable()
export class TeamspaceDocModel extends BaseModel {
  async addDoc(teamspaceId: string, docId: string) {
    // Remove from any existing teamspace first (one doc = one teamspace)
    await this.db.teamspaceDoc.deleteMany({
      where: { docId },
    });

    return await this.db.teamspaceDoc.create({
      data: { teamspaceId, docId },
    });
  }

  async removeDoc(docId: string) {
    await this.db.teamspaceDoc.deleteMany({
      where: { docId },
    });
  }

  async moveDoc(docId: string, newTeamspaceId: string) {
    await this.db.teamspaceDoc.deleteMany({
      where: { docId },
    });
    return await this.db.teamspaceDoc.create({
      data: { teamspaceId: newTeamspaceId, docId },
    });
  }

  async findByDoc(docId: string) {
    return await this.db.teamspaceDoc.findFirst({
      where: { docId },
    });
  }

  /** Teamspace assignment for `docId` within a single cloud workspace (may differ from another doc's teamspace). */
  async findByDocForWorkspace(docId: string, workspaceId: string) {
    return await this.db.teamspaceDoc.findFirst({
      where: {
        docId,
        teamspace: { workspaceId },
      },
      select: { teamspaceId: true },
    });
  }

  async findByTeamspace(teamspaceId: string) {
    return await this.db.teamspaceDoc.findMany({
      where: { teamspaceId },
      orderBy: { addedAt: 'asc' },
    });
  }

  async getDocIdsByTeamspace(teamspaceId: string) {
    const docs = await this.db.teamspaceDoc.findMany({
      where: { teamspaceId },
      select: { docId: true },
    });
    return docs.map((d: { docId: string }) => d.docId);
  }

  /**
   * Get all doc IDs accessible to a user across their teamspace memberships.
   * This includes docs in teamspaces the user is a member of.
   */
  async getAccessibleDocIds(
    workspaceId: string,
    userId: string
  ): Promise<Set<string>> {
    const docs = await this.db.teamspaceDoc.findMany({
      where: {
        teamspace: {
          workspaceId,
          members: { some: { userId } },
        },
      },
      select: { docId: true },
    });
    return new Set(docs.map((d: { docId: string }) => d.docId));
  }

  /**
   * Get all doc IDs that belong to ANY teamspace in a workspace.
   * Used to determine which docs are "unassigned" (visible only to Owner/Admin).
   */
  async getAllAssignedDocIds(workspaceId: string) {
    const docs = await this.db.teamspaceDoc.findMany({
      where: {
        teamspace: { workspaceId },
      },
      select: { docId: true },
    });
    return new Set(docs.map((d: { docId: string }) => d.docId));
  }

  /**
   * Check if a specific user can access a specific doc via teamspace membership.
   */
  async canUserAccessDoc(
    userId: string,
    docId: string,
    isOwnerOrAdmin: boolean
  ): Promise<boolean> {
    // Workspace Owner/Admin can access all docs
    if (isOwnerOrAdmin) {
      return true;
    }

    // Check if doc is assigned to any teamspace
    const teamspaceDoc = await this.findByDoc(docId);

    // Doc not in any teamspace → only visible to Owner/Admin (already handled above)
    if (!teamspaceDoc) {
      return false;
    }

    // Doc in a teamspace → check if user is a member
    const membership = await this.db.teamspaceUserRole.findUnique({
      where: {
        teamspaceId_userId: {
          teamspaceId: teamspaceDoc.teamspaceId,
          userId,
        },
      },
    });

    return !!membership;
  }
}
