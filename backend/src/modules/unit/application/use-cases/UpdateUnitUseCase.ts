import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';
import { UnitRepository } from '../ports/UnitRepository.js';

export interface UpdateUnitInput {
  name?: string;
  driverName?: string;
}

@Injectable()
export class UpdateUnitUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(id: string, input: UpdateUnitInput): Promise<Unit> {
    const unitId = UnitId.restore(id);
    const existing = await this.unitRepository.findById(unitId);
    if (!existing) throw new UnitNotFoundError();

    const updated = existing.update(input);
    const saved = await this.unitRepository.update(unitId, updated);
    if (!saved) throw new UnitNotFoundError();
    return saved;
  }
}
