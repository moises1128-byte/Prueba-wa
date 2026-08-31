import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Unit', {
  description:
    'A vehicle, plus its assigned driver, that can be scheduled for duties.',
})
export class UnitType {
  @Field(() => ID)
  id: string;

  @Field({
    description: 'Vehicle identifier (e.g. license plate or fleet code).',
  })
  name: string;

  @Field({ description: 'The driver currently assigned to this unit.' })
  driverName: string;
}
