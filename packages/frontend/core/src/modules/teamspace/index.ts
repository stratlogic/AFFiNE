import { Framework } from '@toeverything/infra';
import { WorkspaceScope } from '../workspace';
import { WorkspaceServerService } from '../cloud';
import { TeamspaceService } from './services/teamspace';

export function configureTeamspaceModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(TeamspaceService, [WorkspaceServerService]);
}

export { TeamspaceService } from './services/teamspace';
