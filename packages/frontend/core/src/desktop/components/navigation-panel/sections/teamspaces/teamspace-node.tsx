import { NavigationPanelTreeNode, NavigationPanelTreeRoot } from '../../tree';
import { NavigationPanelDocNode } from '../../nodes/doc';
import { NavigationPanelFolderNode } from '../../nodes/folder';
import { TeamspaceService, type Teamspace } from '@affine/core/modules/teamspace';
import { OrganizeService } from '@affine/core/modules/organize';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { GroupIcon, FolderIcon, PlusIcon, PageIcon } from '@blocksuite/icons/rc';
import { useState, useCallback, useMemo } from 'react';
import { useService, useLiveData } from '@toeverything/infra';
import { IconButton, MenuItem, Menu } from '@affine/component';
import { useI18n } from '@affine/i18n';
import { generateFractionalIndexingKeyBetween } from '@toeverything/infra';
import type { NodeOperation } from '../../tree/types';
import { usePageHelper } from '@affine/core/blocksuite/block-suite-page-list/utils';

const childLocation = {
  at: 'navigation-panel:teamspace:list' as const,
};

export const TeamspaceNode = ({
  teamspace,
  path,
  index,
}: {
  teamspace: Teamspace;
  path: string;
  index: number;
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const t = useI18n();

  const teamspaceService = useService(TeamspaceService);
  const workspaceService = useService(WorkspaceService);

  const organizeService = useService(OrganizeService);
  
  const fakeRootId = `teamspace:${teamspace.id}`;
  
  const teamspaceRoot = useMemo(() => {
    return organizeService.folderTree.folderNode$(fakeRootId);
  }, [organizeService.folderTree, fakeRootId]);

  const teamspaceRootNode = useLiveData(teamspaceRoot);
  const folders = useLiveData(useMemo(() => teamspaceRootNode?.sortedChildren$ || null, [teamspaceRootNode]));

  const handleCreateFolder = useCallback(() => {
    if (!teamspaceRootNode) return;
    
    teamspaceRootNode.createFolder(
      t['com.affine.rootAppSidebar.organize.newFolder'] ? t['com.affine.rootAppSidebar.organize.newFolder']() : 'New Folder',
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
    teamspaceService.moveDocToTeamspace(workspaceService.workspace.id, page.id, teamspace.id);
    setCollapsed(false);
  }, [createPage, teamspace.id, teamspaceService, workspaceService.workspace.id, setCollapsed]);

  const canEdit = teamspace.currentUserRole === 'Owner' || teamspace.currentUserRole === 'Admin' || teamspace.currentUserRole === 'Member';

  const operations = useMemo<NodeOperation[]>(() => {
    if (!canEdit) return [];
    return [
      {
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
                 {t['com.affine.rootAppSidebar.organize.create-doc'] ? t['com.affine.rootAppSidebar.organize.create-doc']() : 'New Doc'}
               </MenuItem>,
               <MenuItem
                 key="create-folder"
                 prefixIcon={<FolderIcon />}
                 onClick={handleCreateFolder}
               >
                 {t['com.affine.rootAppSidebar.organize.create-folder'] ? t['com.affine.rootAppSidebar.organize.create-folder']() : 'New Folder'}
               </MenuItem>
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
      },
    ];
  }, [canEdit, handleCreateDoc, handleCreateFolder, t, teamspace.id]);

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
      canDrop={(args) => canEdit && args.source.data.entity?.type === 'doc'}
      onDrop={(data) => {
         if (data.source.data.entity?.type === 'doc') {
             teamspaceService.moveDocToTeamspace(workspaceService.workspace.id, data.source.data.entity.id, teamspace.id);
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
