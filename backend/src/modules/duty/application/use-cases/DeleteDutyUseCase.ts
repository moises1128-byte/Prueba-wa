import { Injectable } from '@nestjs/common';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { DutyNotFoundError } from '../../domain/errors/DutyErrors.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';

@Injectable()
export class DeleteDutyUseCase {
  constructor(
    private readonly dutyRepository: DutyRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  async execute(id: string): Promise<boolean> {
    const dutyId = DutyId.restore(id);
    const existing = await this.dutyRepository.findById(dutyId);
    if (!existing) throw new DutyNotFoundError();

    await this.unitRepository.releaseWindow(existing.unitId, dutyId.value);
    await this.dutyRepository.delete(dutyId);
    return true;
  }
}
