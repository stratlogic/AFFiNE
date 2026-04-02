import { describe, expect, test, vi } from 'vitest';

import { TeamspaceService } from './teamspace';

describe('TeamspaceService', () => {
  test('throws when createTeamspace response is empty', async () => {
    const gql = vi.fn().mockResolvedValue({});
    const service = new TeamspaceService({
      server: { gql },
    } as any);

    await expect(
      service.createTeamspace('ws-1', {
        name: 'Engineering',
        visibility: 'Open',
      })
    ).rejects.toThrow('Failed to create teamspace: No response data');
  });

  test('removeDocFromTeamspace refreshes teamspaces and access ids', async () => {
    const gql = vi.fn().mockResolvedValue({ removeDocFromTeamspace: true });
    const service = new TeamspaceService({
      server: { gql },
    } as any);

    const fetchAccessibleDocIds = vi
      .spyOn(service, 'fetchAccessibleDocIds')
      .mockResolvedValue();
    const fetchTeamspaces = vi.spyOn(service, 'fetchTeamspaces').mockResolvedValue();

    const success = await service.removeDocFromTeamspace('ws-1', 'doc-1');

    expect(success).toBe(true);
    expect(fetchAccessibleDocIds).toHaveBeenCalledWith('ws-1');
    expect(fetchTeamspaces).toHaveBeenCalledWith('ws-1');
  });
});
