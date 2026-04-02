import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { TeamspaceResolver } from './resolver';
import { TeamspaceService } from './service';

@Module({
  imports: [PermissionModule],
  providers: [TeamspaceResolver, TeamspaceService],
  exports: [TeamspaceService],
})
export class TeamspaceModule {}

export { TeamspaceService } from './service';
export { TeamspaceType } from './types';
