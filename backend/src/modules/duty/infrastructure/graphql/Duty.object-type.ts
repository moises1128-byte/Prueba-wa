import { Field, ID, ObjectType } from '@nestjs/graphql';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';

@ObjectType('Duty', {
  description:
    'A time window during which a unit is assigned to drive a route. A unit can never hold two duties with overlapping windows — this is enforced atomically, even under concurrent requests.',
})
export class DutyType {
  @Field(() => ID)
  id: string;

  @Field(() => ID, { description: 'Id of the route this duty is assigned to.' })
  routeId: string;

  @Field(() => ID, { description: 'Id of the unit performing this duty.' })
  unitId: string;

  @Field({ description: 'Start of the duty window (inclusive).' })
  startsAt: Date;

  @Field({
    description: 'End of the duty window (exclusive of overlap comparisons).',
  })
  endsAt: Date;

  // Populated by DutyResolver's @ResolveField methods, not set directly by the mapper.
  route?: RouteType;
  unit?: UnitType;
}
