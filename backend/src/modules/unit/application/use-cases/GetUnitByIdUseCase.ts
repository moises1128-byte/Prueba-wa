import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitRepository } from '../ports/UnitRepository.js';

@Injectable()
export class GetUnitByIdUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(id: string): Promise<Unit | null> {
    return this.unitRepository.findById(UnitId.restore(id));
  }
}
