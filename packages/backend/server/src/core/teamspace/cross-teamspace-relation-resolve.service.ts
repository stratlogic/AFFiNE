import { Injectable, Logger } from '@nestjs/common';

import { Models } from '../../models';
import { readAllBlocksFromDocSnapshot } from '../utils/blocksuite';

export type RelationResolvedRow = {
  rowId: string;
  title: string;
  exists: boolean;
};

const MAX_ROW_IDS = 64;

@Injectable()
export class CrossTeamspaceRelationResolveService {
  private readonly logger = new Logger(CrossTeamspaceRelationResolveService.name);

  constructor(private readonly models: Models) {}

  /**
   * Resolve row display titles from a persisted page snapshot (no Yjs sync required for caller).
   */
  async resolveRows(
    workspaceId: string,
    targetDocId: string,
    databaseBlockId: string,
    rowIds: string[]
  ): Promise<RelationResolvedRow[]> {
    const unique = [...new Set(rowIds)].slice(0, MAX_ROW_IDS);

    const snap = await this.models.doc.getSnapshot(workspaceId, targetDocId, {
      select: { blob: true },
    });

    if (!snap?.blob || snap.blob.length <= 2) {
      return unique.map(rowId => ({
        rowId,
        title: '(unavailable)',
        exists: false,
      }));
    }

    try {
      const { blocks } = await readAllBlocksFromDocSnapshot(
        targetDocId,
        new Uint8Array(snap.blob)
      );

      const dbBlock = blocks.find(
        b => b.blockId === databaseBlockId && b.flavour === 'affine:database'
      );

      if (!dbBlock) {
        return unique.map(rowId => ({
          rowId,
          title: '(database missing)',
          exists: false,
        }));
      }

      const byId = new Map(blocks.map(b => [b.blockId, b] as const));

      return unique.map(rowId => {
        const row = byId.get(rowId);
        if (!row || row.parentBlockId !== databaseBlockId) {
          return {
            rowId,
            title: '(deleted)',
            exists: false,
          };
        }

        const content = row.content;
        const raw =
          content && content.length > 0
            ? content.join(' ').trim()
            : '';
        const title =
          raw.length > 0 ? raw.slice(0, 500) : 'Untitled';

        return {
          rowId,
          title,
          exists: true,
        };
      });
    } catch (err) {
      this.logger.warn(
        `relation resolve failed for ${workspaceId}/${targetDocId}: ${err}`
      );
      return unique.map(rowId => ({
        rowId,
        title: '(unavailable)',
        exists: false,
      }));
    }
  }
}
