import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase.js';
import { UpdateDutyUseCase } from '../../application/use-cases/UpdateDutyUseCase.js';
import { DeleteDutyUseCase } from '../../application/use-cases/DeleteDutyUseCase.js';
import { GetDutiesUseCase } from '../../application/use-cases/GetDutiesUseCase.js';
import { GetDutyByIdUseCase } from '../../application/use-cases/GetDutyByIdUseCase.js';
import { CreateDutyInput } from './CreateDuty.input.js';
import { UpdateDutyInput } from './UpdateDuty.input.js';
import { DutyType } from './Duty.object-type.js';
import { toDutyType } from './Duty.mapper.js';
import { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { toRouteType } from '../../../route/infrastructure/graphql/Route.mapper.js';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';
import { toUnitType } from '../../../unit/infrastructure/graphql/Unit.mapper.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';

@Resolver(() => DutyType)
export class DutyResolver {
  constructor(
    private readonly createDutyUseCase: CreateDutyUseCase,
    private readonly updateDutyUseCase: UpdateDutyUseCase,
    private readonly deleteDutyUseCase: DeleteDutyUseCase,
    private readonly getDutiesUseCase: GetDutiesUseCase,
    private readonly getDutyByIdUseCase: GetDutyByIdUseCase,
    private readonly routeRepository: RouteRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  @Query(() => [DutyType], {
    description: 'All duties across every route and unit.',
  })
  async duties(): Promise<DutyType[]> {
    const duties = await this.getDutiesUseCase.execute();
    return duties.map(toDutyType);
  }

  @Query(() => DutyType, {
    nullable: true,
    description: 'A single duty by id, or null if it does not exist.',
  })
  async duty(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DutyType | null> {
    const duty = await this.getDutyByIdUseCase.execute(id);
    return duty ? toDutyType(duty) : null;
  }

  @Mutation(() => DutyType, {
    description:
      'Assigns a unit to a route for a time window. Fails with a dutyOverlap error if the unit already holds a duty during any part of that window — checked atomically, so this is safe under concurrent requests.',
  })
  async createDuty(@Args('input') input: CreateDutyInput): Promise<DutyType> {
    const duty = await this.createDutyUseCase.execute(input);
    return toDutyType(duty);
  }

  @Mutation(() => DutyType, {
    description:
      "Updates a duty's route, unit, and/or window. Re-checks the no-overlap invariant whenever the unit or window changes.",
  })
  async updateDuty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateDutyInput,
  ): Promise<DutyType> {
    const duty = await this.updateDutyUseCase.execute(id, input);
    return toDutyType(duty);
  }

  @Mutation(() => Boolean, {
    description:
      'Deletes a duty and frees the time window it held on its unit.',
  })
  async deleteDuty(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.deleteDutyUseCase.execute(id);
  }

  @ResolveField(() => RouteType, {
    description: 'The route this duty is assigned to.',
  })
  async route(@Parent() duty: DutyType): Promise<RouteType> {
    const route = await this.routeRepository.findById(
      RouteId.restore(duty.routeId),
    );
    if (!route) throw new RouteNotFoundError();
    return toRouteType(route);
  }

  @ResolveField(() => UnitType, {
    description: 'The unit performing this duty.',
  })
  async unit(@Parent() duty: DutyType): Promise<UnitType> {
    const unit = await this.unitRepository.findById(
      UnitId.restore(duty.unitId),
    );
    if (!unit) throw new UnitNotFoundError();
    return toUnitType(unit);
  }
}
