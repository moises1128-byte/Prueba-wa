import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyOverlapError } from '../../domain/errors/DutyErrors.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';

export interface CreateDutyInput {
  routeId: string;
  unitId: string;
  startsAt: Date;
  endsAt: Date;
}

@Injectable()
export class CreateDutyUseCase {
  constructor(
    private readonly dutyRepository: DutyRepository,
    private readonly routeRepository: RouteRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  async execute(input: CreateDutyInput): Promise<Duty> {
    const routeId = RouteId.restore(input.routeId);
    const unitId = UnitId.restore(input.unitId);

    const route = await this.routeRepository.findById(routeId);
    if (!route) throw new RouteNotFoundError();

    const unit = await this.unitRepository.findById(unitId);
    if (!unit) throw new UnitNotFoundError();

    const duty = Duty.create({
      routeId,
      unitId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    const reserved = await this.unitRepository.reserveWindow(
      unitId,
      duty.id.value,
      duty.startsAt,
      duty.endsAt,
    );
    if (!reserved) throw new DutyOverlapError();

    try {
      return await this.dutyRepository.create(duty);
    } catch (error) {
      try {
        await this.unitRepository.releaseWindow(unitId, duty.id.value);
      } catch {
        // best-effort rollback; the original persistence error is what the caller needs to see
      }
      throw error;
    }
  }
}
