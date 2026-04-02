import { Module } from '@nestjs/common';

import { DocStorageModule } from '../doc';
import { PermissionModule } from '../permission';
import { TeamspaceModule } from '../teamspace';
import { SpaceSyncGateway } from './gateway';

@Module({
  imports: [DocStorageModule, PermissionModule, TeamspaceModule],
  providers: [SpaceSyncGateway],
})
export class SyncModule {}
