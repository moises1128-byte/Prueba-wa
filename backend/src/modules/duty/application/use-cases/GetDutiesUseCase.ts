import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyRepository } from '../ports/DutyRepository.js';

@Injectable()
export class GetDutiesUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(): Promise<Duty[]> {
    return this.dutyRepository.findAll();
  }
}
