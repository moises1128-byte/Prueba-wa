import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateRouteUseCase } from '../../application/use-cases/CreateRouteUseCase.js';
import { GetRoutesUseCase } from '../../application/use-cases/GetRoutesUseCase.js';
import { GetRouteByIdUseCase } from '../../application/use-cases/GetRouteByIdUseCase.js';
import { UpdateRouteUseCase } from '../../application/use-cases/UpdateRouteUseCase.js';
import { CreateRouteInput } from './CreateRoute.input.js';
import { UpdateRouteInput } from './UpdateRoute.input.js';
import { RouteType } from './Route.object-type.js';
import { toRouteType } from './Route.mapper.js';

@Resolver(() => RouteType)
export class RouteResolver {
  constructor(
    private readonly createRouteUseCase: CreateRouteUseCase,
    private readonly getRoutesUseCase: GetRoutesUseCase,
    private readonly getRouteByIdUseCase: GetRouteByIdUseCase,
    private readonly updateRouteUseCase: UpdateRouteUseCase,
  ) {}

  @Query(() => [RouteType])
  async routes(): Promise<RouteType[]> {
    const routes = await this.getRoutesUseCase.execute();
    return routes.map(toRouteType);
  }

  @Query(() => RouteType, { nullable: true })
  async route(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RouteType | null> {
    const route = await this.getRouteByIdUseCase.execute(id);
    return route ? toRouteType(route) : null;
  }

  @Mutation(() => RouteType)
  async createRoute(
    @Args('input') input: CreateRouteInput,
  ): Promise<RouteType> {
    const route = await this.createRouteUseCase.execute(input);
    return toRouteType(route);
  }

  @Mutation(() => RouteType)
  async updateRoute(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRouteInput,
  ): Promise<RouteType> {
    const route = await this.updateRouteUseCase.execute(id, input);
    return toRouteType(route);
  }
}
