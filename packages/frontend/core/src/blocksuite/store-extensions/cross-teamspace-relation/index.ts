import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blocksuite/affine/ext-loader';
import { CrossTeamspaceRelationHostService } from '@blocksuite/affine-shared/services';

export class CrossTeamspaceRelationHostStoreExtension extends StoreExtensionProvider {
  override name = 'cross-teamspace-relation-host';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(CrossTeamspaceRelationHostService);
  }
}
