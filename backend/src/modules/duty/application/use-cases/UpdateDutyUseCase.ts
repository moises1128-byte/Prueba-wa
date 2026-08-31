import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import {
  DutyNotFoundError,
  DutyOverlapError,
  DutyReservationLostError,
} from '../../domain/errors/DutyErrors.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';

export interface UpdateDutyInput {
  routeId?: string;
  unitId?: string;
  startsAt?: Date;
  endsAt?: Date;
  description?: string;
}

@Injectable()
export class UpdateDutyUseCase {
  constructor(
    private readonly dutyRepository: DutyRepository,
    private readonly routeRepository: RouteRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  async execute(id: string, input: UpdateDutyInput): Promise<Duty> {
    const dutyId = DutyId.restore(id);
    const existing = await this.dutyRepository.findById(dutyId);
    if (!existing) throw new DutyNotFoundError();

    const nextRouteId = input.routeId
      ? RouteId.restore(input.routeId)
      : existing.routeId;
    const nextUnitId = input.unitId
      ? UnitId.restore(input.unitId)
      : existing.unitId;

    if (input.routeId) {
      const route = await this.routeRepository.findById(nextRouteId);
      if (!route) throw new RouteNotFoundError();
    }
    if (input.unitId) {
      const unit = await this.unitRepository.findById(nextUnitId);
      if (!unit) throw new UnitNotFoundError();
    }

    const updated = existing.update({
      routeId: nextRouteId,
      unitId: nextUnitId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      description: input.description,
    });

    const windowUnchanged =
      nextUnitId.equals(existing.unitId) &&
      updated.startsAt.getTime() === existing.startsAt.getTime() &&
      updated.endsAt.getTime() === existing.endsAt.getTime();

    if (!windowUnchanged) {
      await this.unitRepository.releaseWindow(
        existing.unitId,
        existing.id.value,
      );

      const reserved = await this.unitRepository.reserveWindow(
        updated.unitId,
        updated.id.value,
        updated.startsAt,
        updated.endsAt,
      );
      if (!reserved) {
        const reverted = await this.unitRepository.reserveWindow(
          existing.unitId,
          existing.id.value,
          existing.startsAt,
          existing.endsAt,
        );
        if (!reverted) throw new DutyReservationLostError();
        throw new DutyOverlapError();
      }
    }

    try {
      const saved = await this.dutyRepository.update(dutyId, updated);
      if (!saved) throw new DutyNotFoundError();
      return saved;
    } catch (error) {
      if (!windowUnchanged) {
        try {
          await this.unitRepository.releaseWindow(
            updated.unitId,
            updated.id.value,
          );
          await this.unitRepository.reserveWindow(
            existing.unitId,
            existing.id.value,
            existing.startsAt,
            existing.endsAt,
          );
        } catch {
          // best-effort rollback; the original error is what the caller needs to see
        }
      }
      throw error;
    }
  }
}
