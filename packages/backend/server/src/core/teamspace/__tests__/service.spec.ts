import test from 'ava';
import { PrismaClient, WorkspaceMemberStatus } from '@prisma/client';

import { createModule } from '../../../__tests__/create-module';
import { Mockers } from '../../../__tests__/mocks';
import {
  BadRequest,
  MemberNotFoundInSpace,
  SpaceAccessDenied,
} from '../../../base';
import { TeamspaceRole } from '../../../models';
import { TeamspaceModule } from '../index';
import { TeamspaceService } from '../service';

const module = await createModule({
  imports: [TeamspaceModule],
});

const teamspaceService = module.get(TeamspaceService);
const prisma = module.get(PrismaClient);

const owner = await module.create(Mockers.User);
const workspace = await module.create(Mockers.Workspace, { owner });

const member = await module.create(Mockers.User);
await module.create(Mockers.WorkspaceUser, {
  workspaceId: workspace.id,
  userId: member.id,
});

const outsider = await module.create(Mockers.User);

test.after.always(async () => {
  await module.close();
});

test('assertCanViewTeamspace blocks non-member for private teamspace', async t => {
  const ts = await teamspaceService.createTeamspace(workspace.id, {
    name: `private-${Date.now()}`,
    visibility: 'Private',
  });
  await teamspaceService.addMember(workspace.id, ts.id, owner.id);

  await t.throwsAsync(
    () =>
      teamspaceService.assertCanViewTeamspace(workspace.id, ts.id, outsider.id),
    { instanceOf: SpaceAccessDenied }
  );
});

test('assertCanViewTeamspace allows private teamspace member', async t => {
  const ts = await teamspaceService.createTeamspace(workspace.id, {
    name: `private-member-${Date.now()}`,
    visibility: 'Private',
  });
  await teamspaceService.addMember(workspace.id, ts.id, owner.id);
  await teamspaceService.addMember(workspace.id, ts.id, member.id);

  await t.notThrowsAsync(() =>
    teamspaceService.assertCanViewTeamspace(workspace.id, ts.id, member.id)
  );
});

test('addMember requires active workspace membership', async t => {
  const ts = await teamspaceService.createTeamspace(workspace.id, {
    name: `active-check-${Date.now()}`,
    visibility: 'Open',
  });
  await teamspaceService.addMember(workspace.id, ts.id, owner.id);

  await t.throwsAsync(
    () => teamspaceService.addMember(workspace.id, ts.id, outsider.id),
    { instanceOf: MemberNotFoundInSpace }
  );
});

test('addMember rejects pending workspace invitee', async t => {
  const pendingUser = await module.create(Mockers.User);
  await module.create(Mockers.WorkspaceUser, {
    workspaceId: workspace.id,
    userId: pendingUser.id,
    status: WorkspaceMemberStatus.Pending,
  });

  const ts = await teamspaceService.createTeamspace(workspace.id, {
    name: `pending-ws-member-${Date.now()}`,
    visibility: 'Open',
  });
  await teamspaceService.addMember(workspace.id, ts.id, owner.id);

  await t.throwsAsync(
    () => teamspaceService.addMember(workspace.id, ts.id, pendingUser.id),
    { instanceOf: MemberNotFoundInSpace }
  );
});

test('removeMember rejects removing the last teamspace owner', async t => {
  const ts = await teamspaceService.createTeamspace(workspace.id, {
    name: `last-owner-${Date.now()}`,
    visibility: 'Open',
  });
  await teamspaceService.addMember(
    workspace.id,
    ts.id,
    owner.id,
    TeamspaceRole.Owner
  );

  await t.throwsAsync(() => teamspaceService.removeMember(ts.id, owner.id), {
    instanceOf: SpaceAccessDenied,
  });
});

test('createTeamspaceWithOwner adds creator as owner', async t => {
  const ts = await teamspaceService.createTeamspaceWithOwner(
    workspace.id,
    owner.id,
    {
      name: `with-owner-${Date.now()}`,
      visibility: 'Open',
    }
  );

  const membership = await prisma.teamspaceUserRole.findUnique({
    where: {
      teamspaceId_userId: {
        teamspaceId: ts.id,
        userId: owner.id,
      },
    },
  });
  t.truthy(membership);
  t.is(membership?.role, TeamspaceRole.Owner);
});

test('createTeamspaceWithOwner is atomic on membership failure', async t => {
  const name = `atomic-fail-${Date.now()}`;

  await t.throwsAsync(
    () =>
      teamspaceService.createTeamspaceWithOwner(workspace.id, outsider.id, {
        name,
        visibility: 'Open',
      }),
    { instanceOf: MemberNotFoundInSpace }
  );

  const created = await prisma.teamspace.findFirst({
    where: {
      workspaceId: workspace.id,
      name,
    },
  });
  t.is(created, null);
});

test('createTeamspaceWithOwner throws BadRequest on duplicate name', async t => {
  const name = `duplicate-${Date.now()}`;
  await teamspaceService.createTeamspaceWithOwner(workspace.id, owner.id, {
    name,
    visibility: 'Open',
  });

  await t.throwsAsync(
    () =>
      teamspaceService.createTeamspaceWithOwner(workspace.id, owner.id, {
        name,
        visibility: 'Open',
      }),
    { instanceOf: BadRequest }
  );
});
