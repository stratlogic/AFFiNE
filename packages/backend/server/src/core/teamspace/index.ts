import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { CrossTeamspaceRelationPolicy } from './cross-teamspace-relation-policy';
import { CrossTeamspaceRelationResolver } from './cross-teamspace-relation.resolver';
import { CrossTeamspaceRelationResolveService } from './cross-teamspace-relation-resolve.service';
import { TeamspaceResolver } from './resolver';
import { TeamspaceService } from './service';

@Module({
  imports: [PermissionModule],
  providers: [
    TeamspaceResolver,
    TeamspaceService,
    CrossTeamspaceRelationPolicy,
    CrossTeamspaceRelationResolveService,
    CrossTeamspaceRelationResolver,
  ],
  exports: [TeamspaceService, CrossTeamspaceRelationPolicy],
})
export class TeamspaceModule {}

export { CrossTeamspaceRelationPolicy } from './cross-teamspace-relation-policy';
export { TeamspaceService } from './service';
export { TeamspaceType } from './types';
