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

export class TeamspaceService extends Service {
  public accessibleDocIds$ = new LiveData<string[] | null>(null);
  public teamspaces$ = new LiveData<Teamspace[]>([]);
  private activeWorkspaceId: string | null = null;

  constructor(private readonly workspaceServerService: WorkspaceServerService) {
    super();
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

        this.accessibleDocIds$.next((res?.accessibleDocIds as string[]) || null);
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

