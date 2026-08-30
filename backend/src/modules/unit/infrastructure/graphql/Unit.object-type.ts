import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Unit')
export class UnitType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  driverName: string;
}
