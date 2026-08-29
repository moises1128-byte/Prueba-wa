import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RouteRepository } from '../ports/RouteRepository.js';

@Injectable()
export class GetRouteByIdUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(id: string): Promise<Route | null> {
    return this.routeRepository.findById(RouteId.restore(id));
  }
}
