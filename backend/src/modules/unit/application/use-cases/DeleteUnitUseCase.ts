import { Injectable } from '@nestjs/common';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';
import { UnitRepository } from '../ports/UnitRepository.js';

@Injectable()
export class DeleteUnitUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(id: string): Promise<boolean> {
    const deleted = await this.unitRepository.delete(UnitId.restore(id));
    if (!deleted) throw new UnitNotFoundError();
    return true;
  }
}
