import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';

@Injectable()
export class GetDutiesByRouteUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(routeId: string): Promise<Duty[]> {
    return this.dutyRepository.findByRouteId(RouteId.restore(routeId));
  }
}
