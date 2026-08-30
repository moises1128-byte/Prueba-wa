import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitRepository } from '../ports/UnitRepository.js';

export interface CreateUnitInput {
  name: string;
  driverName: string;
}

@Injectable()
export class CreateUnitUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(input: CreateUnitInput): Promise<Unit> {
    const unit = Unit.create(input);
    return this.unitRepository.create(unit);
  }
}
