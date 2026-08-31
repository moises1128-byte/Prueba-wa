import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PointType } from './Point.object-type.js';

@ObjectType('Route', {
  description:
    'An ordered list of geographic points that units can be assigned to drive.',
})
export class RouteType {
  @Field(() => ID)
  id: string;

  @Field({
    nullable: true,
    description: 'Optional human-readable name for the route.',
  })
  name?: string;

  @Field(() => [PointType], {
    description: 'The points that make up this route, in driving order.',
  })
  points: PointType[];
}
