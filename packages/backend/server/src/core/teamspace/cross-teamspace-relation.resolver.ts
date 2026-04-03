import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { SpaceAccessDenied } from '../../base';
import { CurrentUser } from '../auth';
import { AccessController } from '../permission';
import { CrossTeamspaceRelationPolicy } from './cross-teamspace-relation-policy';
import { CrossTeamspaceRelationResolveService } from './cross-teamspace-relation-resolve.service';
import {
  CrossTeamspaceRelationCapabilitiesType,
  CrossTeamspaceRelationRowType,
} from './cross-teamspace-relation.types';

@Resolver()
export class CrossTeamspaceRelationResolver {
  constructor(
    private readonly ac: AccessController,
    private readonly policy: CrossTeamspaceRelationPolicy,
    private readonly resolveService: CrossTeamspaceRelationResolveService
  ) {}

  @Query(() => Boolean, {
    description:
      'Whether cross-teamspace / cross-doc database relation relay is enabled on this server.',
    name: 'crossTeamspaceRelationEnabled',
  })
  crossTeamspaceRelationEnabled(): boolean {
    return globalThis.env.crossTeamspaceRelationEnabled;
  }

  @Query(() => CrossTeamspaceRelationCapabilitiesType, {
    description:
      'Capabilities for cross-doc database relations within a workspace (used by relation column UI)',
  })
  async crossTeamspaceRelationCapabilities(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('sourceDocId', { type: () => ID }) sourceDocId: string,
    @Args('targetDocId', { type: () => ID }) targetDocId: string
  ): Promise<CrossTeamspaceRelationCapabilitiesType> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    if (!globalThis.env.crossTeamspaceRelationEnabled) {
      return { canReadRelay: false, canMutateRelation: false };
    }

    if (sourceDocId === targetDocId) {
      // Same-doc relations use local BlockSuite only; keep API neutral.
      return { canReadRelay: true, canMutateRelation: true };
    }

    return this.policy.evaluate(
      workspaceId,
      user.id,
      sourceDocId,
      targetDocId
    );
  }

  @Query(() => [CrossTeamspaceRelationRowType], {
    description:
      'Resolve relation row titles from the target page snapshot (server-mediated read)',
  })
  async crossTeamspaceRelationRows(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Args('sourceDocId', { type: () => ID }) sourceDocId: string,
    @Args('targetDocId', { type: () => ID }) targetDocId: string,
    @Args('databaseBlockId', { type: () => ID }) databaseBlockId: string,
    @Args('rowIds', { type: () => [String] }) rowIds: string[]
  ): Promise<CrossTeamspaceRelationRowType[]> {
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    if (!globalThis.env.crossTeamspaceRelationEnabled) {
      throw new SpaceAccessDenied({ spaceId: workspaceId });
    }

    if (sourceDocId === targetDocId) {
      throw new SpaceAccessDenied({ spaceId: workspaceId });
    }

    const { canReadRelay } = await this.policy.evaluate(
      workspaceId,
      user.id,
      sourceDocId,
      targetDocId
    );

    if (!canReadRelay) {
      throw new SpaceAccessDenied({ spaceId: workspaceId });
    }

    const rows = await this.resolveService.resolveRows(
      workspaceId,
      targetDocId,
      databaseBlockId,
      rowIds
    );

    return rows;
  }
}
