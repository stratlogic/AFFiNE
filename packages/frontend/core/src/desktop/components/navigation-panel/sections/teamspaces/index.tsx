import { IconButton } from '@affine/component';
import { WorkspaceServerService } from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { TeamspaceService } from '@affine/core/modules/teamspace';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { PlusIcon } from '@blocksuite/icons/rc';
import { useLiveData, useServices } from '@toeverything/infra';
import { useCallback, useMemo, useEffect } from 'react';

import { CollapsibleSection } from '../../layouts/collapsible-section';
import { NavigationPanelTreeRoot } from '../../tree';
import { TeamspaceNode } from './teamspace-node';
import { RootEmpty } from './empty';

export const NavigationPanelTeamspaces = () => {
  const {
    teamspaceService,
    workspaceService,
    workspaceDialogService,
    workspacePermissionService,
    workspaceServerService,
  } =
    useServices({
      WorkspaceServerService,
      TeamspaceService,
      WorkspaceService,
      WorkspaceDialogService,
      WorkspacePermissionService,
    });

  const path = useMemo(() => ['teamspaces'], []);
  const teamspaces = useLiveData(teamspaceService.teamspaces$);
  const isOwnerOrAdmin =
    useLiveData(workspacePermissionService.permission.isOwnerOrAdmin$) ?? false;
  const workspaceId = workspaceService.workspace.id;
  const hasServer = !!workspaceServerService.server;

  useEffect(() => {
    if (!hasServer) {
      return;
    }
    teamspaceService.fetchTeamspaces(workspaceId);
  }, [hasServer, teamspaceService, workspaceId]);

  const handleCreateTeamspace = useCallback(() => {
    workspaceDialogService.open('create-teamspace', {});
  }, [workspaceDialogService]);

  if (!hasServer) {
    // Teamspaces are currently scoped to cloud workspaces.
    return null;
  }

  return (
    <CollapsibleSection
      path={path}
      title="Teamspaces"
      testId="navigation-panel-teamspaces"
      actions={
        isOwnerOrAdmin ? (
          <IconButton
            size="16"
            onClick={handleCreateTeamspace}
            tooltip="Create Teamspace"
          >
            <PlusIcon />
          </IconButton>
        ) : null
      }
    >
      <NavigationPanelTreeRoot
        placeholder={<RootEmpty />}
      >
        {teamspaces.map(ts => (
          <TeamspaceNode
            key={ts.id}
            teamspace={ts}
            parentPath={path}
          />
        ))}
      </NavigationPanelTreeRoot>
    </CollapsibleSection>
  );
};
