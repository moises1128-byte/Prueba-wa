import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RouteRepository } from '../ports/RouteRepository.js';

@Injectable()
export class GetRoutesUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(): Promise<Route[]> {
    return this.routeRepository.findAll();
  }
}
