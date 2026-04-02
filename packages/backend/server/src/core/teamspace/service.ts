import { Injectable } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { MemberNotFoundInSpace, SpaceAccessDenied, SpaceNotFound } from '../../base';
import { Models, TeamspaceRole, TeamspaceVisibility, WorkspaceRole } from '../../models';

@Injectable()
export class TeamspaceService {
  constructor(private readonly models: Models) {}

  private async getWorkspaceRole(workspaceId: string, userId: string) {
    const userRole = await this.models.workspaceUser.getActive(workspaceId, userId);
    return (userRole?.type as WorkspaceRole) ?? null;
  }

  private isOwnerOrAdmin(workspaceRole: WorkspaceRole | null) {
    return (
      workspaceRole === WorkspaceRole.Owner ||
      workspaceRole === WorkspaceRole.Admin
    );
  }

  async createTeamspace(
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      icon?: string;
      visibility?: TeamspaceVisibility;
    }
  ) {
    return await this.models.teamspace.create(workspaceId, data);
  }

  @Transactional()
  async createTeamspaceWithOwner(
    workspaceId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      icon?: string;
      visibility?: TeamspaceVisibility;
    }
  ) {
    const teamspace = await this.createTeamspace(workspaceId, data);
    await this.addMember(workspaceId, teamspace.id, userId, TeamspaceRole.Owner);
    return teamspace;
  }

  async getTeamspace(teamspaceId: string) {
    const teamspace = await this.models.teamspace.getWithMembers(teamspaceId);
    if (!teamspace) {
      throw new SpaceNotFound({ spaceId: teamspaceId });
    }
    return teamspace;
  }

  async listTeamspaces(
    workspaceId: string,
    userId: string,
    workspaceRole: WorkspaceRole | null
  ) {
    const isOwnerOrAdmin = this.isOwnerOrAdmin(workspaceRole);

    return await this.models.teamspace.findVisibleToUser(
      workspaceId,
      userId,
      isOwnerOrAdmin
    );
  }

  async updateTeamspace(
    teamspaceId: string,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      visibility?: TeamspaceVisibility;
    }
  ) {
    return await this.models.teamspace.update(teamspaceId, data);
  }

  async deleteTeamspace(teamspaceId: string) {
    // Docs in this teamspace become "unassigned" (cascade deletes TeamspaceDoc records)
    await this.models.teamspace.delete(teamspaceId);
  }

  async addMember(
    workspaceId: string,
    teamspaceId: string,
    userId: string,
    role: TeamspaceRole = TeamspaceRole.Member
  ) {
    await this.assertTargetUserIsActiveWorkspaceMember(workspaceId, userId);
    return await this.models.teamspaceUser.addMember(
      teamspaceId,
      userId,
      role
    );
  }

  async removeMember(teamspaceId: string, userId: string) {
    await this.assertNotRemovingLastOwner(teamspaceId, userId);
    await this.models.teamspaceUser.removeMember(teamspaceId, userId);
  }

  async updateMemberRole(
    teamspaceId: string,
    userId: string,
    role: TeamspaceRole
  ) {
    await this.assertNotDemotingLastOwner(teamspaceId, userId, role);
    return await this.models.teamspaceUser.updateRole(
      teamspaceId,
      userId,
      role
    );
  }

  async moveDocToTeamspace(docId: string, teamspaceId: string) {
    return await this.models.teamspaceDoc.moveDoc(docId, teamspaceId);
  }

  async removeDocFromTeamspace(docId: string) {
    await this.models.teamspaceDoc.removeDoc(docId);
  }

  /**
   * Get a user's role within a specific teamspace, or null if not a member.
   */
  async getTeamspaceRole(
    teamspaceId: string,
    userId: string
  ): Promise<TeamspaceRole | null> {
    return await this.models.teamspaceUser.getRole(teamspaceId, userId) ?? null;
  }

  /**
   * Assert that a user can ADD an existing doc to a teamspace.
   *
   * Permission logic:
   *  - Workspace Owner/Admin: always allowed.
   *  - Teamspace Owner/Admin: always allowed.
   *  - Teamspace Member: allowed — the resolver layer must separately verify
   *    the user has Doc.Update rights on the doc being moved.
   *  - Anyone else: denied.
   */
  async assertCanAddDocToTeamspace(
    workspaceId: string,
    teamspaceId: string,
    userId: string
  ): Promise<void> {
    const teamspace = await this.models.teamspace.get(teamspaceId);
    if (!teamspace || teamspace.workspaceId !== workspaceId) {
      throw new SpaceNotFound({ spaceId: teamspaceId });
    }

    const wsRole = await this.getWorkspaceRole(workspaceId, userId);
    if (this.isOwnerOrAdmin(wsRole)) return;

    const tsRole = await this.models.teamspaceUser.getRole(teamspaceId, userId);
    if (
      tsRole === TeamspaceRole.Owner ||
      tsRole === TeamspaceRole.Admin ||
      tsRole === TeamspaceRole.Member
    ) {
      return;
    }

    throw new SpaceAccessDenied({ spaceId: teamspaceId });
  }

  /**
   * Assert that a user can REMOVE a doc from a teamspace.
   *
   * Permission logic:
   *  - Workspace Owner/Admin: always allowed.
   *  - Teamspace Owner/Admin: allowed (they manage the teamspace's content).
   *  - Teamspace Member: NOT allowed to remove docs (only add their own).
   */
  async assertCanRemoveDocFromTeamspace(
    workspaceId: string,
    docId: string,
    userId: string
  ): Promise<void> {
    // Find which teamspace the doc belongs to
    const teamspaceDoc = await this.models.teamspaceDoc.findByDoc(docId);

    if (!teamspaceDoc) {
      // Doc isn't in any teamspace — only WS Owner/Admin should be removing
      const wsRole = await this.getWorkspaceRole(workspaceId, userId);
      if (this.isOwnerOrAdmin(wsRole)) return;
      throw new SpaceAccessDenied({ spaceId: workspaceId });
    }

    const wsRole = await this.getWorkspaceRole(workspaceId, userId);
    if (this.isOwnerOrAdmin(wsRole)) return;

    const tsRole = await this.models.teamspaceUser.getRole(
      teamspaceDoc.teamspaceId,
      userId
    );
    if (tsRole === TeamspaceRole.Owner || tsRole === TeamspaceRole.Admin) {
      return;
    }

    throw new SpaceAccessDenied({ spaceId: teamspaceDoc.teamspaceId });
  }

  async getTeamspaceDocs(teamspaceId: string) {
    return await this.models.teamspaceDoc.findByTeamspace(teamspaceId);
  }

  /**
   * Check if a user can access a document based on teamspace membership.
   * Workspace Owner/Admin can always access all docs.
   */
  async canUserAccessDoc(
    workspaceId: string,
    userId: string,
    docId: string
  ): Promise<boolean> {
    const workspaceRole = await this.getWorkspaceRole(workspaceId, userId);
    const isOwnerOrAdmin = this.isOwnerOrAdmin(workspaceRole);

    return await this.models.teamspaceDoc.canUserAccessDoc(
      userId,
      docId,
      isOwnerOrAdmin
    );
  }

  /**
   * Get all doc IDs accessible to a user in a workspace.
   * Used by the sync gateway to filter doc timestamps.
   */
  async getAccessibleDocIds(
    workspaceId: string,
    userId: string
  ): Promise<Set<string>> {
    const workspaceRole = await this.getWorkspaceRole(workspaceId, userId);
    const isOwnerOrAdmin = this.isOwnerOrAdmin(workspaceRole);

    if (isOwnerOrAdmin) {
      // Owner/Admin can access all docs — return empty set to signal "no filtering"
      return new Set<string>();
    }

    return await this.models.teamspaceDoc.getAccessibleDocIds(
      workspaceId,
      userId
    );
  }

  /**
   * Assert that the user has at least Owner/Admin workspace role to manage teamspaces.
   */
  async assertCanManageTeamspaces(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const role = await this.getWorkspaceRole(workspaceId, userId);

    if (role !== WorkspaceRole.Owner && role !== WorkspaceRole.Admin) {
      throw new SpaceAccessDenied({ spaceId: workspaceId });
    }
  }

  /**
   * Assert that the user can manage a specific teamspace's members/docs.
   * Workspace Owner/Admin or Teamspace Owner/Admin can manage.
   */
  async assertCanManageTeamspace(
    workspaceId: string,
    teamspaceId: string,
    userId: string
  ): Promise<void> {
    const teamspace = await this.models.teamspace.get(teamspaceId);
    if (!teamspace || teamspace.workspaceId !== workspaceId) {
      throw new SpaceNotFound({ spaceId: teamspaceId });
    }

    // Workspace Owner/Admin can manage all teamspaces
    const wsRole = await this.getWorkspaceRole(workspaceId, userId);
    if (this.isOwnerOrAdmin(wsRole)) {
      return;
    }

    // Teamspace Owner/Admin can manage their teamspace
    const tsRole = await this.models.teamspaceUser.getRole(
      teamspaceId,
      userId
    );
    if (
      tsRole === TeamspaceRole.Owner ||
      tsRole === TeamspaceRole.Admin
    ) {
      return;
    }

    throw new SpaceAccessDenied({ spaceId: teamspaceId });
  }

  async assertCanViewTeamspace(
    workspaceId: string,
    teamspaceId: string,
    userId: string
  ): Promise<void> {
    const teamspace = await this.models.teamspace.get(teamspaceId);
    if (!teamspace || teamspace.workspaceId !== workspaceId) {
      throw new SpaceNotFound({ spaceId: teamspaceId });
    }

    const wsRole = await this.getWorkspaceRole(workspaceId, userId);
    if (this.isOwnerOrAdmin(wsRole)) {
      return;
    }

    if (teamspace.visibility !== TeamspaceVisibility.Private) {
      return;
    }

    const isMember = await this.models.teamspaceUser.isMember(teamspaceId, userId);
    if (!isMember) {
      throw new SpaceAccessDenied({ spaceId: teamspaceId });
    }
  }

  async assertTargetUserIsActiveWorkspaceMember(
    workspaceId: string,
    userId: string
  ) {
    const activeRole = await this.models.workspaceUser.getActive(workspaceId, userId);
    if (!activeRole) {
      throw new MemberNotFoundInSpace({ spaceId: workspaceId });
    }
  }

  private async assertNotRemovingLastOwner(teamspaceId: string, userId: string) {
    const role = await this.models.teamspaceUser.getRole(teamspaceId, userId);
    if (role !== TeamspaceRole.Owner) {
      return;
    }

    const ownerCount = await this.models.teamspaceUser.getOwnerCount(teamspaceId);
    if (ownerCount <= 1) {
      throw new SpaceAccessDenied({ spaceId: teamspaceId });
    }
  }

  private async assertNotDemotingLastOwner(
    teamspaceId: string,
    userId: string,
    newRole: TeamspaceRole
  ) {
    if (newRole === TeamspaceRole.Owner) {
      return;
    }

    await this.assertNotRemovingLastOwner(teamspaceId, userId);
  }
}
