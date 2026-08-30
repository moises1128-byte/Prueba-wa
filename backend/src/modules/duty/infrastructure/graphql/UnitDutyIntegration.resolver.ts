import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { GetDutiesByUnitUseCase } from '../../application/use-cases/GetDutiesByUnitUseCase.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';
import { DeleteUnitUseCase } from '../../../unit/application/use-cases/DeleteUnitUseCase.js';
import { UnitHasActiveDutiesError } from '../../../unit/domain/errors/UnitErrors.js';

/** Same reasoning as RouteDutyIntegrationResolver — see its doc comment. */
@Resolver(() => UnitType)
export class UnitDutyIntegrationResolver {
  constructor(
    private readonly getDutiesByUnitUseCase: GetDutiesByUnitUseCase,
    private readonly deleteUnitUseCase: DeleteUnitUseCase,
  ) {}

  @Mutation(() => Boolean)
  async deleteUnit(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const duties = await this.getDutiesByUnitUseCase.execute(id);
    if (duties.length > 0) throw new UnitHasActiveDutiesError();
    return this.deleteUnitUseCase.execute(id);
  }
}
