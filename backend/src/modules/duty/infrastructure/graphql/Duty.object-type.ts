import { Field, ID, ObjectType } from '@nestjs/graphql';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';

@ObjectType('Duty')
export class DutyType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  routeId: string;

  @Field(() => ID)
  unitId: string;

  @Field()
  startsAt: Date;

  @Field()
  endsAt: Date;

  // Populated by DutyResolver's @ResolveField methods, not set directly by the mapper.
  route?: RouteType;
  unit?: UnitType;
}
