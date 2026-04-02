import { NavigationPanelTreeNode, NavigationPanelTreeRoot } from '../../tree';
import { NavigationPanelDocNode } from '../../nodes/doc';
import { NavigationPanelFolderNode } from '../../nodes/folder';
import {
  TeamspaceService,
  type Teamspace,
} from '@affine/core/modules/teamspace';
import {
  getDefaultNewFolderName,
  OrganizeService,
} from '@affine/core/modules/organize';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { WorkspaceService } from '@affine/core/modules/workspace';
import {
  AccountIcon,
  GroupIcon,
  FolderIcon,
  PlusIcon,
  PageIcon,
} from '@blocksuite/icons/rc';
import { useState, useCallback, useMemo } from 'react';
import { useService, useLiveData } from '@toeverything/infra';
import { IconButton, MenuItem, Menu } from '@affine/component';
import { useI18n } from '@affine/i18n';
import type { NodeOperation } from '../../tree/types';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';

const childLocation = {
  at: 'navigation-panel:teamspace:list' as const,
};

export const TeamspaceNode = ({
  teamspace,
  path,
  index: _index,
}: {
  teamspace: Teamspace;
  path: string;
  index: number;
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const t = useI18n();

  const teamspaceService = useService(TeamspaceService);
  const workspaceService = useService(WorkspaceService);
  const workspaceDialogService = useService(WorkspaceDialogService);

  const organizeService = useService(OrganizeService);

  const fakeRootId = `teamspace:${teamspace.id}`;

  const teamspaceRoot = useMemo(() => {
    return organizeService.folderTree.folderNode$(fakeRootId);
  }, [organizeService.folderTree, fakeRootId]);

  const teamspaceRootNode = useLiveData(teamspaceRoot);
  const folders = useLiveData(
    useMemo(
      () => teamspaceRootNode?.sortedChildren$ || null,
      [teamspaceRootNode]
    )
  );

  const handleCreateFolder = useCallback(() => {
    if (!teamspaceRootNode) return;

    teamspaceRootNode.createFolder(
      getDefaultNewFolderName(t),
      teamspaceRootNode.indexAt('after')
    );
    setCollapsed(false);
  }, [teamspaceRootNode, t]);

  const nodeIcon = useCallback(() => {
    return <GroupIcon />;
  }, []);

  const { createPage } = usePageHelper(
    workspaceService.workspace.docCollection
  );

  const handleCreateDoc = useCallback(() => {
    const page = createPage();
    // After creating a page natively, also explicitly assign it to the teamspace in PG
    teamspaceService.moveDocToTeamspace(
      workspaceService.workspace.id,
      page.id,
      teamspace.id
    );
    setCollapsed(false);
  }, [
    createPage,
    teamspace.id,
    teamspaceService,
    workspaceService.workspace.id,
    setCollapsed,
  ]);

  const canEdit =
    teamspace.currentUserRole === 'Owner' ||
    teamspace.currentUserRole === 'Admin' ||
    teamspace.currentUserRole === 'Member';
  const canManageMembers =
    teamspace.currentUserRole === 'Owner' ||
    teamspace.currentUserRole === 'Admin';

  const handleAddMember = useCallback(() => {
    workspaceDialogService.open('add-teamspace-member', {
      workspaceId: workspaceService.workspace.id,
      teamspaceId: teamspace.id,
      teamspaceName: teamspace.name,
    });
  }, [
    workspaceDialogService,
    workspaceService.workspace.id,
    teamspace.id,
    teamspace.name,
  ]);

  const operations = useMemo<NodeOperation[]>(() => {
    const ops: NodeOperation[] = [];
    if (canManageMembers) {
      ops.push({
        index: -1,
        inline: true,
        view: (
          <IconButton
            size="16"
            tooltip="Add teamspace member"
            data-testid={`teamspace-add-member-${teamspace.id}`}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              handleAddMember();
            }}
          >
            <AccountIcon />
          </IconButton>
        ),
      });
    }
    if (!canEdit) return ops;
    ops.push({
      index: 0,
      inline: true,
      view: (
        <Menu
          items={[
            <MenuItem
              key="create-doc"
              prefixIcon={<PageIcon />}
              onClick={handleCreateDoc}
            >
              {t['com.affine.rootAppSidebar.organize.create-doc']()}
            </MenuItem>,
            <MenuItem
              key="create-folder"
              prefixIcon={<FolderIcon />}
              onClick={handleCreateFolder}
            >
              {t['com.affine.rootAppSidebar.organize.create-folder']()}
            </MenuItem>,
          ]}
        >
          <IconButton
            size="16"
            data-testid={`teamspace-add-${teamspace.id}`}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <PlusIcon />
          </IconButton>
        </Menu>
      ),
    });
    return ops;
  }, [
    canEdit,
    canManageMembers,
    handleAddMember,
    handleCreateDoc,
    handleCreateFolder,
    t,
    teamspace.id,
  ]);

  return (
    <NavigationPanelTreeNode
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      name={teamspace.name}
      icon={nodeIcon}
      collapsible={true}
      data-testid={`teamspace-node-${teamspace.id}`}
      path={path}
      operations={operations}
      canDrop={args => canEdit && args.source.data.entity?.type === 'doc'}
      onDrop={data => {
        if (data.source.data.entity?.type === 'doc') {
          teamspaceService.moveDocToTeamspace(
            workspaceService.workspace.id,
            data.source.data.entity.id,
            teamspace.id
          );
        }
      }}
    >
      {!collapsed && (
        <NavigationPanelTreeRoot>
          {folders?.map(child => (
            <NavigationPanelFolderNode
              key={child.id}
              nodeId={child.id as string}
              parentPath={path}
              location={{
                at: 'navigation-panel:organize:folder-node',
                nodeId: child.id as string,
              }}
            />
          ))}
          {teamspace.docIds.map(docId => (
            <NavigationPanelDocNode
              key={docId}
              docId={docId}
              parentPath={path}
              location={childLocation}
            />
          ))}
        </NavigationPanelTreeRoot>
      )}
    </NavigationPanelTreeNode>
  );
};
