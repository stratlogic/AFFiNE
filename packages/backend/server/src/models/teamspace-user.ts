import { Injectable } from '@nestjs/common';

import { BaseModel } from './base';
import { TeamspaceRole } from './common';

@Injectable()
export class TeamspaceUserModel extends BaseModel {
  async addMember(
    teamspaceId: string,
    userId: string,
    role: TeamspaceRole = TeamspaceRole.Member
  ) {
    return await this.db.teamspaceUserRole.upsert({
      where: {
        teamspaceId_userId: { teamspaceId, userId },
      },
      create: {
        teamspaceId,
        userId,
        role,
      },
      update: {
        role,
      },
    });
  }

  async removeMember(teamspaceId: string, userId: string) {
    await this.db.teamspaceUserRole.deleteMany({
      where: { teamspaceId, userId },
    });
  }

  async updateRole(
    teamspaceId: string,
    userId: string,
    role: TeamspaceRole
  ) {
    return await this.db.teamspaceUserRole.update({
      where: {
        teamspaceId_userId: { teamspaceId, userId },
      },
      data: { role },
    });
  }

  async isMember(teamspaceId: string, userId: string) {
    const count = await this.db.teamspaceUserRole.count({
      where: { teamspaceId, userId },
    });
    return count > 0;
  }

  async getRole(teamspaceId: string, userId: string) {
    const record = await this.db.teamspaceUserRole.findUnique({
      where: {
        teamspaceId_userId: { teamspaceId, userId },
      },
    });
    return record?.role as TeamspaceRole | null;
  }

  async getMembers(teamspaceId: string) {
    return await this.db.teamspaceUserRole.findMany({
      where: { teamspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMemberCount(teamspaceId: string) {
    return await this.db.teamspaceUserRole.count({
      where: { teamspaceId },
    });
  }

  async getOwnerCount(teamspaceId: string) {
    return await this.db.teamspaceUserRole.count({
      where: {
        teamspaceId,
        role: TeamspaceRole.Owner,
      },
    });
  }

  /**
   * Get all teamspace IDs where a user is a member within a workspace.
   */
  async getUserTeamspaceIds(workspaceId: string, userId: string) {
    const memberships = await this.db.teamspaceUserRole.findMany({
      where: {
        userId,
        teamspace: { workspaceId },
      },
      select: { teamspaceId: true },
    });
    return memberships.map(m => m.teamspaceId);
  }
}
