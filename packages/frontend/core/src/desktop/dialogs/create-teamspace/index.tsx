import {
  ConfirmModal,
  RowInput,
  notify,
} from '@affine/component';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { WorkspaceServerService } from '@affine/core/modules/cloud';
import {
  type DialogComponentProps,
  type WORKSPACE_DIALOG_SCHEMA,
} from '@affine/core/modules/dialogs';
import { TeamspaceService } from '@affine/core/modules/teamspace';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import * as styles from './index.css';

const FormSection = ({
  label,
  input,
}: {
  label: string;
  input: React.ReactNode;
}) => {
  return (
    <section className={styles.section}>
      <label className={styles.label}>{label}</label>
      {input}
    </section>
  );
};

export const CreateTeamspaceDialog = ({
  close,
  ...props
}: DialogComponentProps<WORKSPACE_DIALOG_SCHEMA['create-teamspace']>) => {
  const t = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const teamspaceService = useService(TeamspaceService);
  const workspaceService = useService(WorkspaceService);
  const workspaceServerService = useService(WorkspaceServerService);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close]
  );

  const handleConfirm = useAsyncCallback(async () => {
    if (loading || !name) return;

    if (!workspaceServerService.server) {
      notify.error({
        title: 'Teamspace unavailable',
        message: 'Teamspaces are only supported for cloud workspaces.',
      });
      return;
    }

    setLoading(true);

    try {
      const workspaceId = workspaceService.workspace.id;
      await teamspaceService.createTeamspace(workspaceId, {
        name,
        description,
        visibility: 'Open', // Default for now
      });
      notify.success({ title: 'Teamspace created' });
      close();
    } catch (e) {
      console.error('Failed to create teamspace', e);
      const error = UserFriendlyError.fromAny(e);
      notify.error({
        title: error.name,
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    name,
    description,
    workspaceService,
    teamspaceService,
    workspaceServerService,
    close,
  ]);

  return (
    <ConfirmModal
      open
      onOpenChange={onOpenChange}
      title="Create Teamspace"
      description="Gather docs together and share them with the right people."
      cancelText="Cancel"
      confirmText="Create"
      confirmButtonOptions={{
        disabled: !name,
        loading: loading,
      }}
      onConfirm={handleConfirm}
      {...props}
    >
      <div className={styles.content}>
        <FormSection
          label="Name"
          input={
            <RowInput
              autoFocus
              className={styles.input}
              placeholder="E.g. Engineering, Marketing..."
              maxLength={64}
              onChange={setName}
              value={name}
            />
          }
        />
        <FormSection
          label="Description"
          input={
            <RowInput
              className={styles.input}
              placeholder="What is this teamspace for?"
              maxLength={256}
              onChange={setDescription}
              value={description}
            />
          }
        />
      </div>
    </ConfirmModal>
  );
};
