import { Injectable } from '@nestjs/common';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';
import { RouteRepository } from '../ports/RouteRepository.js';

@Injectable()
export class DeleteRouteUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(id: string): Promise<boolean> {
    const deleted = await this.routeRepository.delete(RouteId.restore(id));
    if (!deleted) throw new RouteNotFoundError();
    return true;
  }
}
