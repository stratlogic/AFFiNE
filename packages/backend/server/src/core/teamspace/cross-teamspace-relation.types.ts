import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description:
    'Cross-teamspace relation permissions (one cloud workspace; source and target pages may sit in different teamspaces)',
})
export class CrossTeamspaceRelationCapabilitiesType {
  @Field({
    description:
      'May call crossTeamspaceRelationRows to load target row labels from snapshots. Workspace Owner/Admin: always. Others: Doc.Read on both pages, member of both teamspaces (for pages assigned in this workspace), and both pages assigned to a teamspace here.',
  })
  canReadRelay!: boolean;

  @Field({
    description:
      'May edit relation column config and cell values on the source doc. Workspace Owner/Admin: always. Others: same gates as canReadRelay plus Doc.Update on the source page.',
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
