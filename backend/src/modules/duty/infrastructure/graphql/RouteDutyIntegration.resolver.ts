import {
  Args,
  ID,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GetDutiesByRouteUseCase } from '../../application/use-cases/GetDutiesByRouteUseCase.js';
import { toDutyType } from './Duty.mapper.js';
import { DutyType } from './Duty.object-type.js';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { DeleteRouteUseCase } from '../../../route/application/use-cases/DeleteRouteUseCase.js';
import { RouteHasActiveDutiesError } from '../../../route/domain/errors/RouteErrors.js';

/**
 * Lives in the `duty` module, not `route`, on purpose: deciding whether a route can be deleted
 * requires knowing about duties, and `route` never imports `duty` (see the plan header's
 * Architecture note and agent_docs/backend/architecture.md). RouteResolver (in the `route`
 * module) intentionally has no `deleteRoute` mutation — this is the only place it's implemented.
 */
@Resolver(() => RouteType)
export class RouteDutyIntegrationResolver {
  constructor(
    private readonly getDutiesByRouteUseCase: GetDutiesByRouteUseCase,
    private readonly deleteRouteUseCase: DeleteRouteUseCase,
  ) {}

  @ResolveField(() => [DutyType])
  async duties(@Parent() route: RouteType): Promise<DutyType[]> {
    const duties = await this.getDutiesByRouteUseCase.execute(route.id);
    return duties.map(toDutyType);
  }

  @Mutation(() => Boolean)
  async deleteRoute(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const duties = await this.getDutiesByRouteUseCase.execute(id);
    if (duties.length > 0) throw new RouteHasActiveDutiesError();
    return this.deleteRouteUseCase.execute(id);
  }
}
