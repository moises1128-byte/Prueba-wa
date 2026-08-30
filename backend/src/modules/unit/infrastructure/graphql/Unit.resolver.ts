import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateUnitUseCase } from '../../application/use-cases/CreateUnitUseCase.js';
import { GetUnitsUseCase } from '../../application/use-cases/GetUnitsUseCase.js';
import { GetUnitByIdUseCase } from '../../application/use-cases/GetUnitByIdUseCase.js';
import { UpdateUnitUseCase } from '../../application/use-cases/UpdateUnitUseCase.js';
import { CreateUnitInput } from './CreateUnit.input.js';
import { UpdateUnitInput } from './UpdateUnit.input.js';
import { UnitType } from './Unit.object-type.js';
import { toUnitType } from './Unit.mapper.js';

@Resolver(() => UnitType)
export class UnitResolver {
  constructor(
    private readonly createUnitUseCase: CreateUnitUseCase,
    private readonly getUnitsUseCase: GetUnitsUseCase,
    private readonly getUnitByIdUseCase: GetUnitByIdUseCase,
    private readonly updateUnitUseCase: UpdateUnitUseCase,
  ) {}

  @Query(() => [UnitType])
  async units(): Promise<UnitType[]> {
    const units = await this.getUnitsUseCase.execute();
    return units.map(toUnitType);
  }

  @Query(() => UnitType, { nullable: true })
  async unit(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<UnitType | null> {
    const unit = await this.getUnitByIdUseCase.execute(id);
    return unit ? toUnitType(unit) : null;
  }

  @Mutation(() => UnitType)
  async createUnit(@Args('input') input: CreateUnitInput): Promise<UnitType> {
    const unit = await this.createUnitUseCase.execute(input);
    return toUnitType(unit);
  }

  @Mutation(() => UnitType)
  async updateUnit(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUnitInput,
  ): Promise<UnitType> {
    const unit = await this.updateUnitUseCase.execute(id, input);
    return toUnitType(unit);
  }
}
