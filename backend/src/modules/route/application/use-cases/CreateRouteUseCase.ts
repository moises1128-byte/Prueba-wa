import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteRepository } from '../ports/RouteRepository.js';

export interface CreateRouteInput {
  name?: string;
  points: { lat: number; lng: number; name?: string }[];
}

@Injectable()
export class CreateRouteUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(input: CreateRouteInput): Promise<Route> {
    const points = input.points.map((point) => RoutePoint.create(point));
    const route = Route.create({ name: input.name, points });
    return this.routeRepository.create(route);
  }
}
