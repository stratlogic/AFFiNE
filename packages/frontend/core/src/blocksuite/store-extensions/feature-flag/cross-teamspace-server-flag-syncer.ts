import type { TeamspaceService } from '@affine/core/modules/teamspace/services/teamspace';
import { FeatureFlagService as BSFeatureFlagService } from '@blocksuite/affine/shared/services';
import { type ExtensionType, StoreExtension } from '@blocksuite/affine/store';

/**
 * When the server opts out of cross-teamspace relation relay (`AFFINE_CROSS_TEAMSPACE_RELATION=false`),
 * force the BlockSuite flag off after user prefs are applied. Does not turn the flag on when the server allows it.
 */
export function getCrossTeamspaceServerFlagSyncer(): ExtensionType {
  class CrossTeamspaceServerFlagSync extends StoreExtension {
    static override key = 'cross-teamspace-server-flag-sync';

    override loaded() {
      const bs = this.store.get(BSFeatureFlagService);
      const teamspace = this.store.workspace
        .teamspaceService as TeamspaceService | undefined;
      if (!teamspace?.hasCloudBackend()) {
        return;
      }
      void teamspace.fetchCrossTeamspaceRelationServerEnabled().then(enabled => {
        if (!enabled) {
          bs.setFlag('enable_cross_teamspace_relation', false);
        }
      });
    }
  }

  return CrossTeamspaceServerFlagSync;
}
