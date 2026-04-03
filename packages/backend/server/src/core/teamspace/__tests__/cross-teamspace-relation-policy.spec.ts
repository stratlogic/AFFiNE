import test from 'ava';

import { WorkspaceRole } from '../../../models';
import { CrossTeamspaceRelationPolicy } from '../cross-teamspace-relation-policy';

function policyWith(mocks: {
  wsRole?: WorkspaceRole | null;
  canAccessSource?: boolean;
  canAccessTarget?: boolean;
  sourceTs?: { teamspaceId: string } | null;
  targetTs?: { teamspaceId: string } | null;
  memberSource?: boolean;
  memberTarget?: boolean;
}) {
  return new CrossTeamspaceRelationPolicy({
    workspaceUser: {
      getActive: async () =>
        mocks.wsRole == null ? null : { type: mocks.wsRole },
    } as any,
    teamspaceDoc: {
      canUserAccessDoc: async (_userId: string, docId: string) => {
        if (docId === 'src') return mocks.canAccessSource ?? true;
        if (docId === 'tgt') return mocks.canAccessTarget ?? true;
        return false;
      },
      findByDoc: async (docId: string) => {
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
  } as any);
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

test('collaborator with source access only: read relay; no mutate if not in both teamspaces', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    canAccessSource: true,
    canAccessTarget: true,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: false,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator in both teamspaces and can access both docs can mutate', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
    canAccessSource: true,
    canAccessTarget: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.true(r.canMutateRelation);
});

test('collaborator: unassigned target doc yields mutate false', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: null,
    canAccessSource: true,
    canAccessTarget: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator without source doc access: no relay', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    canAccessSource: false,
    canAccessTarget: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.false(r.canReadRelay);
  t.false(r.canMutateRelation);
});

test('collaborator cannot mutate if target doc not accessible', async t => {
  const p = policyWith({
    wsRole: WorkspaceRole.Collaborator,
    canAccessSource: true,
    canAccessTarget: false,
    sourceTs: { teamspaceId: 'tsA' },
    targetTs: { teamspaceId: 'tsB' },
    memberSource: true,
    memberTarget: true,
  });
  const r = await p.evaluate('ws', 'user', 'src', 'tgt');
  t.true(r.canReadRelay);
  t.false(r.canMutateRelation);
});
