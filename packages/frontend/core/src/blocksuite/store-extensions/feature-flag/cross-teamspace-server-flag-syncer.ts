import type { FeatureFlagService } from '@affine/core/modules/feature-flag';
import type { TeamspaceService } from '@affine/core/modules/teamspace/services/teamspace';
import { FeatureFlagService as BSFeatureFlagService } from '@blocksuite/affine/shared/services';
import { type ExtensionType, StoreExtension } from '@blocksuite/affine/store';

/**
 * Sync BlockSuite cross-teamspace relay with server + workspace preference: off when the server
 * disables relay; when the server allows it, mirror the Affine experimental flag after prefs load.
 */
export function getCrossTeamspaceServerFlagSyncer(
  featureFlagService: FeatureFlagService
): ExtensionType {
  class CrossTeamspaceServerFlagSync extends StoreExtension {
    static override key = 'cross-teamspace-server-flag-sync';

    override loaded() {
      const bs = this.store.get(BSFeatureFlagService);
      const teamspace = this.store.workspace.teamspaceService as
        | TeamspaceService
        | undefined;
      if (!teamspace?.hasCloudBackend()) {
        return;
      }
      const affineFlag =
        featureFlagService.flags.enable_cross_teamspace_relation;
      void teamspace
        .fetchCrossTeamspaceRelationServerEnabled()
        .then(enabled => {
          if (!enabled) {
            bs.setFlag('enable_cross_teamspace_relation', false);
            return;
          }
          const v = affineFlag.value;
          if (v !== undefined) {
            bs.setFlag('enable_cross_teamspace_relation', v);
          }
        })
        .catch(() => {
          bs.setFlag('enable_cross_teamspace_relation', false);
        });
    }
  }

  return CrossTeamspaceServerFlagSync;
}
