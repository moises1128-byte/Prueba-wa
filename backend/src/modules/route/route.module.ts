import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RouteDocument,
  RouteSchema,
} from './infrastructure/persistence/route.schema.js';
import { RouteRepositoryAdapter } from './infrastructure/persistence/RouteRepositoryAdapter.js';
import { RouteRepository } from './application/ports/RouteRepository.js';
import { CreateRouteUseCase } from './application/use-cases/CreateRouteUseCase.js';
import { UpdateRouteUseCase } from './application/use-cases/UpdateRouteUseCase.js';
import { DeleteRouteUseCase } from './application/use-cases/DeleteRouteUseCase.js';
import { GetRouteByIdUseCase } from './application/use-cases/GetRouteByIdUseCase.js';
import { GetRoutesUseCase } from './application/use-cases/GetRoutesUseCase.js';
import { RouteResolver } from './infrastructure/graphql/Route.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RouteDocument.name, schema: RouteSchema },
    ]),
  ],
  providers: [
    { provide: RouteRepository, useClass: RouteRepositoryAdapter },
    CreateRouteUseCase,
    UpdateRouteUseCase,
    DeleteRouteUseCase,
    GetRouteByIdUseCase,
    GetRoutesUseCase,
    RouteResolver,
  ],
  exports: [RouteRepository, DeleteRouteUseCase],
})
export class RouteModule {}
