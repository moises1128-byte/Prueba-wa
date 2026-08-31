import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString } from 'class-validator';

@InputType({
  description:
    'Input for updating a duty. Omitted fields keep their current value; providing unitId, startsAt, or endsAt re-checks the no-overlap invariant.',
})
export class UpdateDutyInput {
  @Field(() => ID, {
    nullable: true,
    description: 'New route id, if reassigning.',
  })
  @IsOptional()
  @IsString()
  routeId?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'New unit id, if reassigning.',
  })
  @IsOptional()
  @IsString()
  unitId?: string;

  @Field({ nullable: true, description: 'New start of the duty window.' })
  @IsOptional()
  @IsDate()
  startsAt?: Date;

  @Field({ nullable: true, description: 'New end of the duty window.' })
  @IsOptional()
  @IsDate()
  endsAt?: Date;
}
