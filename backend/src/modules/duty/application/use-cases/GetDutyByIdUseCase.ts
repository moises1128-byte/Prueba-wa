import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { DutyRepository } from '../ports/DutyRepository.js';

@Injectable()
export class GetDutyByIdUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(id: string): Promise<Duty | null> {
    return this.dutyRepository.findById(DutyId.restore(id));
  }
}
