import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UnitDocument,
  UnitSchema,
} from './infrastructure/persistence/unit.schema.js';
import { UnitRepositoryAdapter } from './infrastructure/persistence/UnitRepositoryAdapter.js';
import { UnitRepository } from './application/ports/UnitRepository.js';
import { CreateUnitUseCase } from './application/use-cases/CreateUnitUseCase.js';
import { UpdateUnitUseCase } from './application/use-cases/UpdateUnitUseCase.js';
import { DeleteUnitUseCase } from './application/use-cases/DeleteUnitUseCase.js';
import { GetUnitByIdUseCase } from './application/use-cases/GetUnitByIdUseCase.js';
import { GetUnitsUseCase } from './application/use-cases/GetUnitsUseCase.js';
import { UnitResolver } from './infrastructure/graphql/Unit.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UnitDocument.name, schema: UnitSchema },
    ]),
  ],
  providers: [
    { provide: UnitRepository, useClass: UnitRepositoryAdapter },
    CreateUnitUseCase,
    UpdateUnitUseCase,
    DeleteUnitUseCase,
    GetUnitByIdUseCase,
    GetUnitsUseCase,
    UnitResolver,
  ],
  exports: [UnitRepository, DeleteUnitUseCase],
})
export class UnitModule {}
