import { Skeleton } from '@affine/component';
import { GroupIcon } from '@blocksuite/icons/rc';
import { NavigationPanelEmptySection } from '../../layouts/empty-section';

interface RootEmptyProps {
  isLoading?: boolean;
}

const RootEmptyLoading = () => {
  return <Skeleton />;
};

const RootEmptyReady = () => {
  return (
    <NavigationPanelEmptySection
      icon={GroupIcon}
      message="No teamspaces yet."
      messageTestId="sidebar-teamspaces-empty-message"
    />
  );
};

export const RootEmpty = ({ isLoading }: RootEmptyProps) => {
  return isLoading ? <RootEmptyLoading /> : <RootEmptyReady />;
};
