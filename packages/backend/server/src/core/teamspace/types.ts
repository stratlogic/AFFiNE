import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { TeamspaceVisibility } from '../../models';

import { TeamspaceRole } from '../permission';

registerEnumType(TeamspaceVisibility, {
  name: 'TeamspaceVisibility',
  description: 'Visibility level of a teamspace',
});

registerEnumType(TeamspaceRole, {
  name: 'TeamspaceRole',
  description: 'User role in teamspace',
});

@ObjectType()
export class TeamspaceMemberType {
  @Field(() => ID)
  userId!: string;

  @Field({ description: 'Member name' })
  name!: string;

  @Field({ description: 'Member email' })
  email!: string;

  @Field(() => String, { nullable: true, description: 'Member avatar URL' })
  avatarUrl?: string;

  @Field(() => TeamspaceRole, { description: 'Member role in teamspace' })
  role!: TeamspaceRole;
}

@ObjectType()
export class TeamspaceType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { description: 'Workspace ID' })
  workspaceId!: string;

  @Field({ description: 'Teamspace name' })
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Teamspace description',
  })
  description?: string;

  @Field(() => String, { nullable: true, description: 'Teamspace icon' })
  icon?: string;

  @Field(() => TeamspaceVisibility, {
    description: 'Teamspace visibility setting',
  })
  visibility!: TeamspaceVisibility;

  @Field({ description: 'Teamspace created date' })
  createdAt!: Date;

  @Field(() => [TeamspaceMemberType], {
    description: 'Members of the teamspace',
    nullable: true,
  })
  members?: TeamspaceMemberType[];

  @Field(() => [TeamspaceDocType], {
    description: 'Documents in the teamspace',
    nullable: true,
  })
  docs?: TeamspaceDocType[];

  /**
   * The current user's role in this teamspace.
   * null means the user is not a direct member (but may be a WS Owner/Admin).
   */
  @Field(() => TeamspaceRole, {
    nullable: true,
    description: "Current user's role in this teamspace (null = not a member)",
  })
  currentUserRole?: TeamspaceRole | null;
}


@ObjectType()
export class TeamspaceDocType {
  @Field(() => ID, { description: 'Doc ID' })
  docId!: string;

  @Field(() => ID, { description: 'Teamspace ID' })
  teamspaceId!: string;

  @Field({ description: 'Date added to teamspace' })
  addedAt!: Date;
}

@InputType()
export class CreateTeamspaceInput {
  @Field({ description: 'Teamspace name' })
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Teamspace description',
  })
  description?: string;

  @Field(() => String, { nullable: true, description: 'Teamspace icon' })
  icon?: string;

  @Field(() => TeamspaceVisibility, {
    nullable: true,
    description: 'Teamspace visibility',
    defaultValue: TeamspaceVisibility.Open,
  })
  visibility?: TeamspaceVisibility;
}

@InputType()
export class UpdateTeamspaceInput {
  @Field(() => String, { nullable: true, description: 'Teamspace name' })
  name?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Teamspace description',
  })
  description?: string;

  @Field(() => String, { nullable: true, description: 'Teamspace icon' })
  icon?: string;

  @Field(() => TeamspaceVisibility, {
    nullable: true,
    description: 'Teamspace visibility',
  })
  visibility?: TeamspaceVisibility;
}
