import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

@Injectable()
export class GetDutiesByUnitUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(unitId: string): Promise<Duty[]> {
    return this.dutyRepository.findByUnitId(UnitId.restore(unitId));
  }
}
