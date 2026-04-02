import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { AFFiNELogger } from '../../base';
import { WorkspaceRole, TeamspaceVisibility } from '../../models';
import { CurrentUser } from '../auth';
import { AccessController, TeamspaceRole } from '../permission';
import { TeamspaceService } from './service';
import {
  CreateTeamspaceInput,
  TeamspaceDocType,
  TeamspaceMemberType,
  TeamspaceType,
  UpdateTeamspaceInput,
} from './types';

@Resolver(() => TeamspaceType)
export class TeamspaceResolver {
  private readonly logger: AFFiNELogger;

  constructor(
    private readonly teamspaceService: TeamspaceService,
    private readonly ac: AccessController
  ) {
    this.logger = new AFFiNELogger('TeamspaceResolver');
  }

  @Query(() => [TeamspaceType], {
    description: 'List teamspaces visible to the current user in a workspace',
  })
  async teamspaces(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<TeamspaceType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const { role } = await this.ac
      .user(user.id)
      .workspace(workspaceId)
      .permissions();

    const teamspaces = await this.teamspaceService.listTeamspaces(
      workspaceId,
      user.id,
      role
    );

    // Attach currentUserRole so the frontend can gate UI actions
    const withRoles = await Promise.all(
      teamspaces.map(async (ts: (typeof teamspaces)[number]) => {
        const currentUserRole = await this.teamspaceService.getTeamspaceRole(
          ts.id,
          user.id
        );

        let docs = ts.docs;
        if (ts.visibility === TeamspaceVisibility.Closed && !currentUserRole) {
          docs = []; // Hide content for non-members in Closed teamspaces
        }

        return {
          ...(ts as object),
          currentUserRole,
          docs,
        };
      })
    );

    return withRoles as unknown as TeamspaceType[];
  }

  @Query(() => TeamspaceType, {
    description: 'Get a specific teamspace',
    nullable: true,
  })
  async teamspace(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string
  ): Promise<TeamspaceType | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    await this.teamspaceService.assertCanViewTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    const teamspace = await this.teamspaceService.getTeamspace(teamspaceId);
    if (!teamspace) return null;

    // Transform members
    const result: TeamspaceType = {
      ...(teamspace as any),
      members: teamspace.members.map(
        (m: any): TeamspaceMemberType => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl ?? undefined,
          role: m.role as TeamspaceRole,
        })
      ),
    };

    return result;
  }

  @Query(() => [String], {
    nullable: true,
    description:
      'Get all doc IDs accessible to the current user in a workspace (for sidebar filtering)',
  })
  async accessibleDocIds(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string
  ): Promise<string[] | null> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    const docIds = await this.teamspaceService.getAccessibleDocIds(
      workspaceId,
      user.id
    );

    // Empty set means "Owner/Admin — no filtering needed"
    // Return empty array to signal this
    if (docIds.size === 0) {
      // Check if user is actually Owner/Admin
      const { role } = await this.ac
        .user(user.id)
        .workspace(workspaceId)
        .permissions();

      if (role === WorkspaceRole.Owner || role === WorkspaceRole.Admin) {
        return null; // Special: null = no filtering for admins
      }
    }

    return Array.from(docIds);
  }

  @Mutation(() => TeamspaceType, {
    description: 'Create a new teamspace (Owner/Admin only)',
  })
  async createTeamspace(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('input') input: CreateTeamspaceInput
  ): Promise<TeamspaceType> {
    await this.teamspaceService.assertCanManageTeamspaces(workspaceId, user.id);

    const teamspace = await this.teamspaceService.createTeamspaceWithOwner(
      workspaceId,
      user.id,
      input
    );

    this.logger.log(
      `Teamspace "${input.name}" created in workspace ${workspaceId} by ${user.id}`
    );

    return teamspace as unknown as TeamspaceType;
  }

  @Mutation(() => TeamspaceType, {
    description: 'Update a teamspace',
  })
  async updateTeamspace(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string,
    @Args('input') input: UpdateTeamspaceInput
  ): Promise<TeamspaceType> {
    await this.teamspaceService.assertCanManageTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    const updated = await this.teamspaceService.updateTeamspace(
      teamspaceId,
      input
    );

    return updated as unknown as TeamspaceType;
  }

  @Mutation(() => Boolean, {
    description: 'Delete a teamspace (docs become unassigned)',
  })
  async deleteTeamspace(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string
  ): Promise<boolean> {
    await this.teamspaceService.assertCanManageTeamspaces(workspaceId, user.id);

    await this.teamspaceService.deleteTeamspace(teamspaceId);

    this.logger.log(
      `Teamspace ${teamspaceId} deleted from workspace ${workspaceId} by ${user.id}`
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Add a member to a teamspace',
  })
  async addTeamspaceMember(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string,
    @Args('userId', { type: () => ID }) targetUserId: string,
    @Args('role', {
      type: () => TeamspaceRole,
      defaultValue: TeamspaceRole.Member,
    })
    role: TeamspaceRole
  ): Promise<boolean> {
    await this.teamspaceService.assertCanManageTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    await this.teamspaceService.addMember(
      workspaceId,
      teamspaceId,
      targetUserId,
      role
    );

    this.logger.log(
      `User ${targetUserId} added to teamspace ${teamspaceId} with role ${role}`
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Remove a member from a teamspace',
  })
  async removeTeamspaceMember(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string,
    @Args('userId', { type: () => ID }) targetUserId: string
  ): Promise<boolean> {
    await this.teamspaceService.assertCanManageTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    await this.teamspaceService.removeMember(teamspaceId, targetUserId);

    this.logger.log(
      `User ${targetUserId} removed from teamspace ${teamspaceId}`
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Update a member role in a teamspace',
  })
  async updateTeamspaceMemberRole(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string,
    @Args('userId', { type: () => ID }) targetUserId: string,
    @Args('role', { type: () => TeamspaceRole }) role: TeamspaceRole
  ): Promise<boolean> {
    await this.teamspaceService.assertCanManageTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    await this.teamspaceService.updateMemberRole(
      teamspaceId,
      targetUserId,
      role
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Move a document into a teamspace',
  })
  async moveDocToTeamspace(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('docId', { type: () => ID }) docId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string
  ): Promise<boolean> {
    // Verify the user can update the doc (they must own or have edit access)
    await this.ac.user(user.id).doc(workspaceId, docId).assert('Doc.Update');
    // Verify the user is at least a Member of the target teamspace (or WS Admin/Owner)
    await this.teamspaceService.assertCanAddDocToTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    await this.teamspaceService.moveDocToTeamspace(docId, teamspaceId);

    this.logger.log(
      `Doc ${docId} moved to teamspace ${teamspaceId} by ${user.id}`
    );

    return true;
  }

  @Mutation(() => Boolean, {
    description:
      'Remove a document from its teamspace (becomes unassigned, visible only to Owner/Admin)',
  })
  async removeDocFromTeamspace(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('docId', { type: () => ID }) docId: string
  ): Promise<boolean> {
    // Teamspace Owner/Admin OR Workspace Owner/Admin can remove
    await this.teamspaceService.assertCanRemoveDocFromTeamspace(
      workspaceId,
      docId,
      user.id
    );

    await this.teamspaceService.removeDocFromTeamspace(docId);

    this.logger.log(`Doc ${docId} removed from teamspace by ${user.id}`);

    return true;
  }

  @Query(() => [TeamspaceDocType], {
    description: 'Get docs in a teamspace',
  })
  async teamspaceDocs(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('teamspaceId', { type: () => ID }) teamspaceId: string
  ): Promise<TeamspaceDocType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');
    await this.teamspaceService.assertCanViewTeamspace(
      workspaceId,
      teamspaceId,
      user.id
    );

    const docs = await this.teamspaceService.getTeamspaceDocs(teamspaceId);
    return docs as unknown as TeamspaceDocType[];
  }

  @Query(() => Boolean, {
    name: 'crossWorkspaceRelationRelayEnabled',
    description:
      'Whether server-mediated cross-workspace database relation relay is enabled.',
  })
  crossWorkspaceRelationRelayEnabled(): boolean {
    return globalThis.env.crossWorkspaceRelationRelayEnabled;
  }
}
