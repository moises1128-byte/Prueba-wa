import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateDutyUseCase } from './UpdateDutyUseCase.js';
import type { DutyRepository } from '../ports/DutyRepository.js';
import type { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import {
  DutyOverlapError,
  DutyNotFoundError,
  DutyReservationLostError,
} from '../../domain/errors/DutyErrors.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';

describe('UpdateDutyUseCase', () => {
  let dutyRepository: DutyRepository;
  let routeRepository: RouteRepository;
  let unitRepository: UnitRepository;
  let useCase: UpdateDutyUseCase;
  let route: Route;
  let unit: Unit;
  let existing: Duty;

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    existing = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    dutyRepository = {
      create: vi.fn(),
      update: vi.fn(async (_id, duty) => duty),
      delete: vi.fn(),
      findById: vi.fn(async () => existing),
      findAll: vi.fn(),
      findByRouteId: vi.fn(),
      findByUnitId: vi.fn(),
    };
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(async () => route),
      findAll: vi.fn(),
    };
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(async () => unit),
      findAll: vi.fn(),
      reserveWindow: vi.fn(async () => true),
      releaseWindow: vi.fn(),
    };
    useCase = new UpdateDutyUseCase(
      dutyRepository,
      routeRepository,
      unitRepository,
    );
  });

  it('releases the old window and reserves the new one', async () => {
    const newEnd = new Date('2026-01-01T18:00:00Z');
    await useCase.execute(existing.id.value, { endsAt: newEnd });

    expect(unitRepository.releaseWindow).toHaveBeenCalledWith(
      unit.id,
      existing.id.value,
    );
    expect(unitRepository.reserveWindow).toHaveBeenCalledWith(
      unit.id,
      existing.id.value,
      existing.startsAt,
      newEnd,
    );
  });

  it('throws DutyNotFoundError when the duty does not exist', async () => {
    vi.mocked(dutyRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing', {})).rejects.toThrow(
      DutyNotFoundError,
    );
  });

  it('reverts the old window and throws DutyOverlapError when the new window conflicts', async () => {
    vi.mocked(unitRepository.reserveWindow).mockResolvedValueOnce(false); // the new-window attempt fails

    await expect(
      useCase.execute(existing.id.value, {
        endsAt: new Date('2026-01-01T20:00:00Z'),
      }),
    ).rejects.toThrow(DutyOverlapError);

    // reverted: reserveWindow called a second time with the ORIGINAL window
    expect(unitRepository.reserveWindow).toHaveBeenCalledTimes(2);
    expect(unitRepository.reserveWindow).toHaveBeenLastCalledWith(
      unit.id,
      existing.id.value,
      existing.startsAt,
      existing.endsAt,
    );
    expect(dutyRepository.update).not.toHaveBeenCalled();
  });

  it('throws DutyReservationLostError when even the revert-reserve fails', async () => {
    vi.mocked(unitRepository.reserveWindow)
      .mockResolvedValueOnce(false) // new-window attempt fails
      .mockResolvedValueOnce(false); // revert attempt ALSO fails

    await expect(
      useCase.execute(existing.id.value, {
        endsAt: new Date('2026-01-01T20:00:00Z'),
      }),
    ).rejects.toThrow(DutyReservationLostError);
    expect(dutyRepository.update).not.toHaveBeenCalled();
  });

  it('rolls back the new reservation and restores the old one when dutyRepository.update fails', async () => {
    vi.mocked(dutyRepository.update).mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute(existing.id.value, {
        endsAt: new Date('2026-01-01T20:00:00Z'),
      }),
    ).rejects.toThrow('db down');

    expect(unitRepository.releaseWindow).toHaveBeenCalledWith(
      unit.id,
      existing.id.value,
    );
    expect(unitRepository.reserveWindow).toHaveBeenCalledTimes(2);
    expect(unitRepository.reserveWindow).toHaveBeenLastCalledWith(
      unit.id,
      existing.id.value,
      existing.startsAt,
      existing.endsAt,
    );
  });

  it('does not touch the window reservation when neither unit nor window changes', async () => {
    const newRoute = Route.create({ points: [] });
    vi.mocked(routeRepository.findById).mockResolvedValue(newRoute);

    await useCase.execute(existing.id.value, { routeId: newRoute.id.value });

    expect(unitRepository.releaseWindow).not.toHaveBeenCalled();
    expect(unitRepository.reserveWindow).not.toHaveBeenCalled();
    expect(dutyRepository.update).toHaveBeenCalledOnce();
  });

  it('throws UnitNotFoundError when reassigning to a unit that does not exist', async () => {
    vi.mocked(unitRepository.findById).mockImplementation(async (id) =>
      id.equals(unit.id) ? unit : null,
    );

    await expect(
      useCase.execute(existing.id.value, { unitId: 'missing-unit' }),
    ).rejects.toThrow(UnitNotFoundError);
  });
});
