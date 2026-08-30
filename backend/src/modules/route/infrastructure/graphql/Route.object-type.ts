import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PointType } from './Point.object-type.js';

@ObjectType('Route')
export class RouteType {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => [PointType])
  points: PointType[];
}
