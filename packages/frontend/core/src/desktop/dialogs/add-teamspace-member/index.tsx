import { ConfirmModal, RowInput, notify } from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import {
  type DialogComponentProps,
  type WORKSPACE_DIALOG_SCHEMA,
} from '@affine/core/modules/dialogs';
import { TeamspaceService } from '@affine/core/modules/teamspace';
import { UserFriendlyError } from '@affine/error';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import * as styles from '../create-teamspace/index.css';

export const AddTeamspaceMemberDialog = ({
  close,
  workspaceId,
  teamspaceId,
  teamspaceName,
  ...props
}: DialogComponentProps<WORKSPACE_DIALOG_SCHEMA['add-teamspace-member']>) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const teamspaceService = useService(TeamspaceService);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close]
  );

  const handleConfirm = useAsyncCallback(async () => {
    if (loading || !email.trim()) return;

    setLoading(true);
    try {
      await teamspaceService.addTeamspaceMemberByEmail(
        workspaceId,
        teamspaceId,
        {
          email: email.trim(),
        }
      );
      notify.success({
        title: 'Member added',
        message: `Added to ${teamspaceName}`,
      });
      close();
    } catch (e) {
      console.error('Failed to add teamspace member', e);
      const error = UserFriendlyError.fromAny(e);
      let message = error.message;
      if (error.name === 'MEMBER_NOT_FOUND_IN_SPACE') {
        message =
          'This person must be an active workspace member (invitation accepted). Invite them in Settings → Members; after they join, add them here.';
      }
      if (e instanceof Error && e.message === 'USER_NOT_FOUND_FOR_TEAMSPACE') {
        message =
          'No active member matches this email in your workspace. If they were invited, they must accept first (Settings → Members). Otherwise invite them to the workspace, then try again.';
      }
      notify.error({
        title: 'Could not add member',
        message,
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    email,
    workspaceId,
    teamspaceId,
    teamspaceName,
    teamspaceService,
    close,
  ]);

  return (
    <ConfirmModal
      open
      onOpenChange={onOpenChange}
      title="Add teamspace member"
      description={`Add someone who has already accepted the workspace invitation (active member) to “${teamspaceName}” by email.`}
      cancelText="Cancel"
      confirmText="Add"
      confirmButtonOptions={{
        disabled: !email.trim(),
        loading,
      }}
      onConfirm={handleConfirm}
      {...props}
    >
      <div className={styles.content}>
        <section className={styles.section}>
          <label className={styles.label}>Email</label>
          <RowInput
            autoFocus
            type="email"
            className={styles.input}
            placeholder="colleague@company.com"
            onChange={setEmail}
            value={email}
          />
        </section>
      </div>
    </ConfirmModal>
  );
};
