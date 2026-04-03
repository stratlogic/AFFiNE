import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Cross-teamspace relation permission capabilities' })
export class CrossTeamspaceRelationCapabilitiesType {
  @Field({ description: 'User may call relation row resolve (read chip labels)' })
  canReadRelay!: boolean;

  @Field({
    description:
      'User may edit relation column config and cell values (both teamspaces for non-admin)',
  })
  canMutateRelation!: boolean;
}

@ObjectType({ description: 'Resolved database row for a relation cell' })
export class CrossTeamspaceRelationRowType {
  @Field(() => ID)
  rowId!: string;

  @Field({ description: 'Display title extracted from snapshot' })
  title!: string;

  @Field({
    description: 'False if row or database block is missing in the snapshot',
  })
  exists!: boolean;
}
