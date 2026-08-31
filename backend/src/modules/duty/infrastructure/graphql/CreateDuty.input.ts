import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

@InputType({
  description: 'Input for assigning a unit to a route for a time window.',
})
export class CreateDutyInput {
  @Field(() => ID, { description: 'Id of the route to assign.' })
  @IsString()
  @IsNotEmpty({ message: 'Route is required' })
  routeId: string;

  @Field(() => ID, { description: 'Id of the unit to assign.' })
  @IsString()
  @IsNotEmpty({ message: 'Unit is required' })
  unitId: string;

  @Field({ description: 'Start of the duty window.' })
  @IsDate()
  startsAt: Date;

  @Field({ description: 'End of the duty window. Must be after startsAt.' })
  @IsDate()
  endsAt: Date;
}
