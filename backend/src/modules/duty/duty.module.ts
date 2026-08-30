import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RouteModule } from '../route/route.module.js';
import { UnitModule } from '../unit/unit.module.js';
import {
  DutyDocument,
  DutySchema,
} from './infrastructure/persistence/duty.schema.js';
import { DutyRepositoryAdapter } from './infrastructure/persistence/DutyRepositoryAdapter.js';
import { DutyRepository } from './application/ports/DutyRepository.js';
import { CreateDutyUseCase } from './application/use-cases/CreateDutyUseCase.js';
import { UpdateDutyUseCase } from './application/use-cases/UpdateDutyUseCase.js';
import { DeleteDutyUseCase } from './application/use-cases/DeleteDutyUseCase.js';
import { GetDutyByIdUseCase } from './application/use-cases/GetDutyByIdUseCase.js';
import { GetDutiesUseCase } from './application/use-cases/GetDutiesUseCase.js';
import { GetDutiesByRouteUseCase } from './application/use-cases/GetDutiesByRouteUseCase.js';
import { GetDutiesByUnitUseCase } from './application/use-cases/GetDutiesByUnitUseCase.js';
import { DutyResolver } from './infrastructure/graphql/Duty.resolver.js';
import { RouteDutyIntegrationResolver } from './infrastructure/graphql/RouteDutyIntegration.resolver.js';
import { UnitDutyIntegrationResolver } from './infrastructure/graphql/UnitDutyIntegration.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DutyDocument.name, schema: DutySchema },
    ]),
    RouteModule,
    UnitModule,
  ],
  providers: [
    { provide: DutyRepository, useClass: DutyRepositoryAdapter },
    CreateDutyUseCase,
    UpdateDutyUseCase,
    DeleteDutyUseCase,
    GetDutyByIdUseCase,
    GetDutiesUseCase,
    GetDutiesByRouteUseCase,
    GetDutiesByUnitUseCase,
    DutyResolver,
    RouteDutyIntegrationResolver,
    UnitDutyIntegrationResolver,
  ],
})
export class DutyModule {}
