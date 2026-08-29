import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';
import { RouteRepository } from '../ports/RouteRepository.js';

export interface UpdateRouteInput {
  name?: string;
  points?: { lat: number; lng: number; name?: string }[];
}

@Injectable()
export class UpdateRouteUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(id: string, input: UpdateRouteInput): Promise<Route> {
    const routeId = RouteId.restore(id);
    const existing = await this.routeRepository.findById(routeId);
    if (!existing) throw new RouteNotFoundError();

    const updated = existing.update({
      name: input.name,
      points: input.points?.map((point) => RoutePoint.create(point)),
    });

    const saved = await this.routeRepository.update(routeId, updated);
    if (!saved) throw new RouteNotFoundError();
    return saved;
  }
}
