import test from 'ava';

import { WorkspaceRole } from '../../../models';
import { TeamspaceVisibility } from '../../../models/teamspace';
import { Action } from '../../permission/types';
import { CrossTeamspaceRelationPolicy } from '../cross-teamspace-relation-policy';

function policyWith(mocks: {
  wsRole?: WorkspaceRole | null;
  docReadSource?: boolean;
  docReadTarget?: boolean;
  docUpdateSource?: boolean;
  sourceTs?: { teamspaceId: string } | null;
  targetTs?: { teamspaceId: string } | null;
  memberSource?: boolean;
  memberTarget?: boolean;
  /** Per teamspace visibility for `teamspace.get` (default Open). */
  teamspaceVisibility?: Record<string, TeamspaceVisibility>;
}) {
  const docReadSource = mocks.docReadSource ?? true;
  const docReadTarget = mocks.docReadTarget ?? true;
  const docUpdateSource = mocks.docUpdateSource ?? true;

  const ac = {
    user: (_userId: string) => ({
      doc: (_workspaceId: string, docId: string) => ({
        can: async (action: string) => {
          if (docId === 'src') {
            if (action === Action.Doc.Read) return docReadSource;
            if (action === Action.Doc.Update) return docUpdateSource;
          }
          if (docId === 'tgt' && action === Action.Doc.Read) {
            return docReadTarget;
          }
          return false;
        },
      }),
    }),
  };

  return new CrossTeamspaceRelationPolicy(
    {
      workspaceUser: {
        getActive: async () =>
          mocks.wsRole == null ? null : { type: mocks.wsRole },
      } as any,
      teamspaceDoc: {
        findByDocForWorkspace: async (docId: string, workspaceId: string) => {
          if (workspaceId !== 'ws') return null;
          if (docId === 'src') return mocks.sourceTs ?? null;
          if (docId === 'tgt') return mocks.targetTs ?? null;
          return null;
        },
      } as any,
      teamspaceUser: {
        isMember: async (teamspaceId: string) => {
          if (teamspaceId === 'tsA') return mocks.memberSource ?? false;
          if (teamspaceId === 'tsB') return mocks.memberTarget ?? false;
          return false;
        },
      } as any,
      teamspace: {
        get: async (teamspaceId: string) => {
          const visibility =
            mocks.teamspaceVisibility?.[teamspaceId] ??
            TeamspaceVisibility.Open;
          return {
            id: teamspaceId,
            workspaceId: 'ws',
            visibility,
          };
        },
      } as any,
    } as any,
    ac as any
  );
}

test('workspace Owner can read relay and mutate', async t => {
  const p = policyWith({ wsRole: WorkspaceRole.Owner });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.true(r.canMutateRelation);
});

test('workspace Admin can read relay and mutate', async t => {
  const p = policyWith({ wsRole: WorkspaceRole.Admin });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.true(r.canMutateRelation);
});

test('collaborator TS1 only (private TS2): no relay and no mutate', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: false,
    teamspaceVisibility: { tsB: TeamspaceVisibility.Private },
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.false(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator: Open target teamspace without explicit membership still relays when Doc.Read both', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: false,
    teamspaceVisibility: { tsB: TeamspaceVisibility.Open },
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.true(r.canMutateRelation);
});

test('collaborator in both teamspaces with Doc.Read both and Doc.Update source: relay and mutate', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
    docReadSource: true,
    docReadTarget: true,
    docUpdateSource: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.true(r.canMutateRelation);
});

test('collaborator dual member: relay yes, mutate no without Doc.Update on source', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
    docUpdateSource: false,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator: unassigned target doc yields no relay and no mutate', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: null,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.false(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator without Doc.Read on source: no relay', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    docReadSource: false,
    docReadTarget: true,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.false(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator in both teamspaces but no Doc.Read on target: no relay', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    docReadSource: true,
    docReadTarget: false,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.false(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator: docs not assigned in the requested cloud workspace yields no relay', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
  });
  const r = await p.evaluate('other-workspace', 'user', 'src', 'tgt');
  t.false(r.canReadRelay);
  t.false(r.canMutateRelation);
});
