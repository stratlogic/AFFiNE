import { Framework } from '@toeverything/infra';
import { describe, expect, test, vi } from 'vitest';

import { WorkspaceServerService } from '../../cloud/services/workspace-server';
import { TeamspaceService } from './teamspace';

function createTeamspaceServiceWithGql(gql: ReturnType<typeof vi.fn>) {
  const framework = new Framework();
  framework
    .service(WorkspaceServerService)
    .service(TeamspaceService, [WorkspaceServerService]);
  const provider = framework.provider();
  const workspaceServer = provider.get(WorkspaceServerService);
  workspaceServer.bindServer({ gql } as any);
  return provider.get(TeamspaceService);
}

describe('TeamspaceService', () => {
  test('throws when createTeamspace response is empty', async () => {
    const gql = vi.fn().mockResolvedValue({});
    const service = createTeamspaceServiceWithGql(gql);

    await expect(
      service.createTeamspace('ws-1', {
        name: 'Engineering',
        visibility: 'Open',
      })
    ).rejects.toThrow('Failed to create teamspace: No response data');
  });

  test('removeDocFromTeamspace refreshes teamspaces and access ids', async () => {
    const gql = vi.fn().mockResolvedValue({ removeDocFromTeamspace: true });
    const service = createTeamspaceServiceWithGql(gql);

    const fetchAccessibleDocIds = vi
      .spyOn(service, 'fetchAccessibleDocIds')
      .mockResolvedValue();
    const fetchTeamspaces = vi
      .spyOn(service, 'fetchTeamspaces')
      .mockResolvedValue();

    const success = await service.removeDocFromTeamspace('ws-1', 'doc-1');

    expect(success).toBe(true);
    expect(fetchAccessibleDocIds).toHaveBeenCalledWith('ws-1');
    expect(fetchTeamspaces).toHaveBeenCalledWith('ws-1');
  });

  test('addTeamspaceMemberByEmail looks up user then adds member', async () => {
    const gql = vi
      .fn()
      .mockResolvedValueOnce({
        user: { __typename: 'UserType', id: 'user-2' },
      })
      .mockResolvedValueOnce({ addTeamspaceMember: true });
    const service = createTeamspaceServiceWithGql(gql);

    const fetchTeamspaces = vi
      .spyOn(service, 'fetchTeamspaces')
      .mockResolvedValue();
    const fetchAccessibleDocIds = vi
      .spyOn(service, 'fetchAccessibleDocIds')
      .mockResolvedValue();

    await service.addTeamspaceMemberByEmail('ws-1', 'ts-1', {
      email: 'Someone@Example.com',
    });

    expect(gql).toHaveBeenCalledTimes(2);
    expect(gql.mock.calls[1][0].variables).toMatchObject({
      workspaceId: 'ws-1',
      teamspaceId: 'ts-1',
      userId: 'user-2',
      role: 'Member',
    });
    expect(fetchTeamspaces).toHaveBeenCalledWith('ws-1');
    expect(fetchAccessibleDocIds).toHaveBeenCalledWith('ws-1');
  });

  test('addTeamspaceMemberByEmail throws when user cannot be resolved', async () => {
    const gql = vi.fn().mockResolvedValue({ user: null });
    const service = createTeamspaceServiceWithGql(gql);

    await expect(
      service.addTeamspaceMemberByEmail('ws-1', 'ts-1', {
        email: 'nope@example.com',
      })
    ).rejects.toThrow('USER_NOT_FOUND_FOR_TEAMSPACE');
  });
});
