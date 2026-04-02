import { Injectable } from '@nestjs/common';
import { Prisma, TeamspaceVisibility } from '@prisma/client';

import { BadRequest } from '../base';
import { BaseModel } from './base';
import { TeamspaceRole } from './common';

export { TeamspaceVisibility };

@Injectable()
export class TeamspaceModel extends BaseModel {
  async create(
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      icon?: string;
      visibility?: TeamspaceVisibility;
      defaultDocRole?: number;
    }
  ) {
    try {
      return await this.db.teamspace.create({
        data: {
          workspaceId,
          name: data.name,
          description: data.description,
          icon: data.icon,
          visibility: data.visibility ?? TeamspaceVisibility.Open,
          defaultDocRole: data.defaultDocRole ?? TeamspaceRole.Member,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequest(
          'Teamspace with this name already exists in this workspace.'
        );
      }
      throw error;
    }
  }

  async get(teamspaceId: string) {
    return await this.db.teamspace.findUnique({
      where: { id: teamspaceId },
    });
  }

  async getWithMembers(teamspaceId: string) {
    return await this.db.teamspace.findUnique({
      where: { id: teamspaceId },
      include: {
        members: {
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
        },
      },
    });
  }

  async findByWorkspace(workspaceId: string) {
    return await this.db.teamspace.findMany({
      where: { workspaceId },
      include: {
        docs: true,
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * List teamspaces visible to a user in a workspace.
   * - Open and Closed teamspaces are always visible
   * - Private teamspaces are only visible to members
   * - Workspace Owner/Admin can see all teamspaces
   */
  async findVisibleToUser(
    workspaceId: string,
    userId: string,
    isOwnerOrAdmin: boolean
  ) {
    if (isOwnerOrAdmin) {
      return this.findByWorkspace(workspaceId);
    }

    return await this.db.teamspace.findMany({
      where: {
        workspaceId,
        OR: [
          { visibility: { not: TeamspaceVisibility.Private } },
          {
            visibility: TeamspaceVisibility.Private,
            members: { some: { userId } },
          },
        ],
      },
      include: {
        docs: true,
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    teamspaceId: string,
    data: {
      name?: string;
      description?: string;
      icon?: string;
      visibility?: TeamspaceVisibility;
      defaultDocRole?: number;
    }
  ) {
    return await this.db.teamspace.update({
      where: { id: teamspaceId },
      data,
    });
  }

  async delete(teamspaceId: string) {
    await this.db.teamspace.delete({
      where: { id: teamspaceId },
    });
  }

  async exists(teamspaceId: string) {
    const count = await this.db.teamspace.count({
      where: { id: teamspaceId },
    });
    return count > 0;
  }
}
