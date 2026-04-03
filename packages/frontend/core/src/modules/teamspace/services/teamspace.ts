import type {
  RelationCapabilities,
  ResolvedRelationRow,
  TeamspaceRelationBridge,
} from '@blocksuite/affine-shared/services';
import { LiveData, Service } from '@toeverything/infra';

import { WorkspaceServerService } from '../../cloud';

export interface Teamspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: 'Open' | 'Closed' | 'Private';
  currentUserRole: 'Owner' | 'Admin' | 'Member' | null;
  docIds: string[];
}

// GraphQLQuery objects required by gqlFetcherFactory — must have { id, op, query }
// so that formatRequestBody can read `query.query` for the HTTP body.
const getAccessibleDocIdsQuery = {
  id: 'getAccessibleDocIdsQuery' as const,
  op: 'getAccessibleDocIds',
  query: `query getAccessibleDocIds($workspaceId: ID!) {
    accessibleDocIds(workspaceId: $workspaceId)
  }`,
};

const getTeamspacesQuery = {
  id: 'getTeamspacesQuery' as const,
  op: 'getTeamspaces',
  query: `query getTeamspaces($workspaceId: ID!) {
    teamspaces(workspaceId: $workspaceId) {
      id
      name
      description
      icon
      visibility
      currentUserRole
      createdAt
      docs {
        docId
      }
    }
  }`,
};

const createTeamspaceMutation = {
  id: 'createTeamspaceMutation' as const,
  op: 'createTeamspace',
  query: `mutation createTeamspace($workspaceId: ID!, $input: CreateTeamspaceInput!) {
    createTeamspace(workspaceId: $workspaceId, input: $input) {
      id
      name
      description
      icon
      visibility
    }
  }`,
};

const moveDocToTeamspaceMutation = {
  id: 'moveDocToTeamspaceMutation' as const,
  op: 'moveDocToTeamspace',
  query: `mutation moveDocToTeamspace($workspaceId: ID!, $docId: ID!, $teamspaceId: ID!) {
    moveDocToTeamspace(workspaceId: $workspaceId, docId: $docId, teamspaceId: $teamspaceId)
  }`,
};

const removeDocFromTeamspaceMutation = {
  id: 'removeDocFromTeamspaceMutation' as const,
  op: 'removeDocFromTeamspace',
  query: `mutation removeDocFromTeamspace($workspaceId: ID!, $docId: ID!) {
    removeDocFromTeamspace(workspaceId: $workspaceId, docId: $docId)
  }`,
};

const teamspaceInviteLookupUserQuery = {
  id: 'teamspaceInviteLookupUserQuery' as const,
  op: 'teamspaceInviteLookupUser',
  query: `query teamspaceInviteLookupUser($email: String!) {
    user(email: $email) {
      __typename
      ... on UserType {
        id
      }
      ... on LimitedUserType {
        email
      }
    }
  }`,
};

const addTeamspaceMemberMutation = {
  id: 'addTeamspaceMemberMutation' as const,
  op: 'addTeamspaceMember',
  query: `mutation addTeamspaceMember($workspaceId: ID!, $teamspaceId: ID!, $userId: ID!, $role: TeamspaceRole) {
    addTeamspaceMember(workspaceId: $workspaceId, teamspaceId: $teamspaceId, userId: $userId, role: $role)
  }`,
};

const crossTeamspaceRelationCapabilitiesQuery = {
  id: 'crossTeamspaceRelationCapabilitiesQuery' as const,
  op: 'crossTeamspaceRelationCapabilities',
  query: `query crossTeamspaceRelationCapabilities($workspaceId: ID!, $sourceDocId: ID!, $targetDocId: ID!) {
    crossTeamspaceRelationCapabilities(workspaceId: $workspaceId, sourceDocId: $sourceDocId, targetDocId: $targetDocId) {
      canReadRelay
      canMutateRelation
    }
  }`,
};

const crossTeamspaceRelationRowsQuery = {
  id: 'crossTeamspaceRelationRowsQuery' as const,
  op: 'crossTeamspaceRelationRows',
  query: `query crossTeamspaceRelationRows($workspaceId: ID!, $sourceDocId: ID!, $targetDocId: ID!, $databaseBlockId: ID!, $rowIds: [String!]!) {
    crossTeamspaceRelationRows(workspaceId: $workspaceId, sourceDocId: $sourceDocId, targetDocId: $targetDocId, databaseBlockId: $databaseBlockId, rowIds: $rowIds) {
      rowId
      title
      exists
    }
  }`,
};

const crossTeamspaceRelationEnabledQuery = {
  id: 'crossTeamspaceRelationEnabledQuery' as const,
  op: 'crossTeamspaceRelationEnabled',
  query: `query crossTeamspaceRelationEnabled {
    crossTeamspaceRelationEnabled
  }`,
};

export class TeamspaceService extends Service implements TeamspaceRelationBridge {
  public accessibleDocIds$ = new LiveData<string[] | null>(null);
  public teamspaces$ = new LiveData<Teamspace[]>([]);
  private activeWorkspaceId: string | null = null;

  constructor(private readonly workspaceServerService: WorkspaceServerService) {
    super();
  }

  hasCloudBackend(): boolean {
    return !!this.workspaceServerService.server;
  }

  /**
   * Server kill-switch for cross-teamspace relation relay. When false, clients should not
   * enable the BlockSuite flag (see cross-teamspace-server-flag-syncer).
   */
  async fetchCrossTeamspaceRelationServerEnabled(): Promise<boolean> {
    const server = this.workspaceServerService.server;
    if (!server) {
      return false;
    }
    try {
      const res = (await server.gql({
        query: crossTeamspaceRelationEnabledQuery,
      } as any)) as { crossTeamspaceRelationEnabled?: boolean };
      return res?.crossTeamspaceRelationEnabled ?? false;
    } catch (e) {
      console.warn('crossTeamspaceRelationEnabled query failed', e);
      return false;
    }
  }

  async crossTeamspaceRelationCapabilities(
    workspaceId: string,
    sourceDocId: string,
    targetDocId: string
  ): Promise<RelationCapabilities> {
    const server = this.workspaceServerService.server;
    if (!server) {
      return { canReadRelay: false, canMutateRelation: false };
    }
    try {
      const res = (await server.gql({
        query: crossTeamspaceRelationCapabilitiesQuery,
        variables: { workspaceId, sourceDocId, targetDocId },
      } as any)) as {
        crossTeamspaceRelationCapabilities?: RelationCapabilities;
      };
      return (
        res?.crossTeamspaceRelationCapabilities ?? {
          canReadRelay: false,
          canMutateRelation: false,
        }
      );
    } catch (e) {
      console.warn('crossTeamspaceRelationCapabilities failed', e);
      return { canReadRelay: false, canMutateRelation: false };
    }
  }

  async crossTeamspaceRelationRows(
    workspaceId: string,
    sourceDocId: string,
    targetDocId: string,
    databaseBlockId: string,
    rowIds: string[]
  ): Promise<ResolvedRelationRow[]> {
    const server = this.workspaceServerService.server;
    if (!server) {
      return [];
    }
    try {
      const res = (await server.gql({
        query: crossTeamspaceRelationRowsQuery,
        variables: {
          workspaceId,
          sourceDocId,
          targetDocId,
          databaseBlockId,
          rowIds,
        },
      } as any)) as { crossTeamspaceRelationRows?: ResolvedRelationRow[] };
      return res?.crossTeamspaceRelationRows ?? [];
    } catch (e) {
      console.warn('crossTeamspaceRelationRows failed', e);
      return [];
    }
  }

  private fetchDocIdsPromise: Promise<void> | null = null;
  async fetchAccessibleDocIds(workspaceId: string): Promise<void> {
    if (this.activeWorkspaceId !== workspaceId) {
      this.activeWorkspaceId = workspaceId;
      this.fetchDocIdsPromise = null;
      this.accessibleDocIds$.next(null);
      this.teamspaces$.next([]);
    }

    if (this.fetchDocIdsPromise) return this.fetchDocIdsPromise;

    const server = this.workspaceServerService.server;
    if (!server) {
      // Local workspace, no teamspaces, return null to show all
      this.accessibleDocIds$.next(null);
      return;
    }

    this.fetchDocIdsPromise = (async () => {
      try {
        const res = (await server.gql({
          query: getAccessibleDocIdsQuery,
          variables: { workspaceId },
        } as any)) as any;

        this.accessibleDocIds$.next(
          (res?.accessibleDocIds as string[]) || null
        );
      } catch (e) {
        console.warn('Failed to fetch accessible doc ids', e);
        // Ignore or default to null
        this.accessibleDocIds$.next(null);
      }
    })();

    try {
      await this.fetchDocIdsPromise;
    } finally {
      this.fetchDocIdsPromise = null;
    }
  }

  async fetchTeamspaces(workspaceId: string): Promise<void> {
    if (this.activeWorkspaceId !== workspaceId) {
      this.activeWorkspaceId = workspaceId;
      this.fetchDocIdsPromise = null;
      this.accessibleDocIds$.next(null);
      this.teamspaces$.next([]);
    }

    const server = this.workspaceServerService.server;
    if (!server) {
      this.teamspaces$.next([]);
      return;
    }

    try {
      const res = (await server.gql({
        query: getTeamspacesQuery,
        variables: { workspaceId },
      } as any)) as any;

      const teamspaces = (res?.teamspaces || []) as any[];
      this.teamspaces$.next(
        teamspaces.map(ts => ({
          ...ts,
          docIds: (ts.docs || []).map((d: any) => d.docId),
        }))
      );
    } catch (e) {
      console.warn('Failed to fetch teamspaces', e);
      this.teamspaces$.next([]);
    }
  }

  async createTeamspace(
    workspaceId: string,
    input: {
      name: string;
      description?: string;
      icon?: string;
      visibility?: 'Open' | 'Closed' | 'Private';
    }
  ): Promise<Teamspace | null> {
    const server = this.workspaceServerService.server;
    if (!server) return null;

    const res = (await server.gql({
      query: createTeamspaceMutation,
      variables: { workspaceId, input },
    } as any)) as any;

    if (!res?.createTeamspace) {
      throw new Error('Failed to create teamspace: No response data');
    }

    const newTeamspace: Teamspace = {
      ...res.createTeamspace,
      currentUserRole: 'Owner', // the creator is automatically the Owner
      docIds: [],
    };
    this.teamspaces$.next([...this.teamspaces$.value, newTeamspace]);
    await this.fetchTeamspaces(workspaceId);
    return newTeamspace;
  }

  async moveDocToTeamspace(
    workspaceId: string,
    docId: string,
    teamspaceId: string
  ): Promise<boolean> {
    const server = this.workspaceServerService.server;
    if (!server) return false;

    try {
      await server.gql({
        query: moveDocToTeamspaceMutation,
        variables: { workspaceId, docId, teamspaceId },
      } as any);

      // Re-fetch both permissions and teamspace tree after move
      await this.fetchAccessibleDocIds(workspaceId);
      await this.fetchTeamspaces(workspaceId);
      return true;
    } catch (e) {
      console.warn('Failed to move doc to teamspace', e);
      return false;
    }
  }

  /**
   * Path A: resolve email via `user(email)` (same-workspace scope), then `addTeamspaceMember`.
   * Target must already be an active workspace member.
   */
  async addTeamspaceMemberByEmail(
    workspaceId: string,
    teamspaceId: string,
    input: { email: string; role?: 'Owner' | 'Admin' | 'Member' | 'Viewer' }
  ): Promise<void> {
    const server = this.workspaceServerService.server;
    if (!server) {
      throw new Error('Teamspaces require a cloud workspace');
    }

    const normalized = input.email.trim().toLowerCase();
    if (!normalized) {
      throw new Error('Email is required');
    }

    const lookup = (await server.gql({
      query: teamspaceInviteLookupUserQuery,
      variables: { email: normalized },
    } as any)) as {
      user?: { __typename: string; id?: string } | null;
    };

    const user = lookup?.user;
    const userId =
      user?.__typename === 'UserType' && user.id ? user.id : undefined;

    if (!userId) {
      const err = new Error('USER_NOT_FOUND_FOR_TEAMSPACE') as Error & {
        code: string;
      };
      err.code = 'USER_NOT_FOUND_FOR_TEAMSPACE';
      throw err;
    }

    await server.gql({
      query: addTeamspaceMemberMutation,
      variables: {
        workspaceId,
        teamspaceId,
        userId,
        role: input.role ?? 'Member',
      },
    } as any);

    await this.fetchTeamspaces(workspaceId);
    await this.fetchAccessibleDocIds(workspaceId);
  }

  async removeDocFromTeamspace(
    workspaceId: string,
    docId: string
  ): Promise<boolean> {
    const server = this.workspaceServerService.server;
    if (!server) return false;

    try {
      await server.gql({
        query: removeDocFromTeamspaceMutation,
        variables: { workspaceId, docId },
      } as any);

      await this.fetchAccessibleDocIds(workspaceId);
      await this.fetchTeamspaces(workspaceId);
      return true;
    } catch (e) {
      console.warn('Failed to remove doc from teamspace', e);
      return false;
    }
  }
}
