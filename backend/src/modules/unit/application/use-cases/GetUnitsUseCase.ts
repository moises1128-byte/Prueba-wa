import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitRepository } from '../ports/UnitRepository.js';

@Injectable()
export class GetUnitsUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(): Promise<Unit[]> {
    return this.unitRepository.findAll();
  }
}
