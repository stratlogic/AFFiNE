import { Service } from '@toeverything/infra';

import { FolderTree } from '../entities/folder-tree';
import { FolderStore } from '../stores/folder';

export class OrganizeService extends Service {
  constructor(public readonly folderStore: FolderStore) {
    super();
  }

  folderTree = this.framework.createEntity(FolderTree);
}
