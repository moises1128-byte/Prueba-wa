import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateDutyUseCase } from './CreateDutyUseCase.js';
import type { DutyRepository } from '../ports/DutyRepository.js';
import type { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';
import { DutyOverlapError } from '../../domain/errors/DutyErrors.js';

describe('CreateDutyUseCase', () => {
  let dutyRepository: DutyRepository;
  let routeRepository: RouteRepository;
  let unitRepository: UnitRepository;
  let useCase: CreateDutyUseCase;
  let route: Route;
  let unit: Unit;

  const input = {
    startsAt: new Date('2026-01-01T08:00:00Z'),
    endsAt: new Date('2026-01-01T16:00:00Z'),
  };

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });

    dutyRepository = {
      create: vi.fn(async (duty) => duty),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
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
    useCase = new CreateDutyUseCase(
      dutyRepository,
      routeRepository,
      unitRepository,
    );
  });

  it('creates a duty when the route and unit exist and the window is free', async () => {
    const result = await useCase.execute({
      routeId: route.id.value,
      unitId: unit.id.value,
      ...input,
    });

    expect(unitRepository.reserveWindow).toHaveBeenCalledOnce();
    expect(dutyRepository.create).toHaveBeenCalledOnce();
    expect(result.routeId.equals(route.id)).toBe(true);
  });

  it('throws RouteNotFoundError when the route does not exist', async () => {
    vi.mocked(routeRepository.findById).mockResolvedValue(null);
    await expect(
      useCase.execute({ routeId: 'missing', unitId: unit.id.value, ...input }),
    ).rejects.toThrow(RouteNotFoundError);
    expect(unitRepository.reserveWindow).not.toHaveBeenCalled();
  });

  it('throws UnitNotFoundError when the unit does not exist', async () => {
    vi.mocked(unitRepository.findById).mockResolvedValue(null);
    await expect(
      useCase.execute({ routeId: route.id.value, unitId: 'missing', ...input }),
    ).rejects.toThrow(UnitNotFoundError);
  });

  it('throws DutyOverlapError when the window guard rejects the reservation', async () => {
    vi.mocked(unitRepository.reserveWindow).mockResolvedValue(false);
    await expect(
      useCase.execute({
        routeId: route.id.value,
        unitId: unit.id.value,
        ...input,
      }),
    ).rejects.toThrow(DutyOverlapError);
    expect(dutyRepository.create).not.toHaveBeenCalled();
  });

  it('releases the reserved window if persisting the duty fails', async () => {
    vi.mocked(dutyRepository.create).mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        routeId: route.id.value,
        unitId: unit.id.value,
        ...input,
      }),
    ).rejects.toThrow('db down');
    expect(unitRepository.releaseWindow).toHaveBeenCalledOnce();
  });

  it('does not call releaseWindow when the window guard rejects the reservation', async () => {
    vi.mocked(unitRepository.reserveWindow).mockResolvedValue(false);
    await expect(
      useCase.execute({
        routeId: route.id.value,
        unitId: unit.id.value,
        ...input,
      }),
    ).rejects.toThrow(DutyOverlapError);
    expect(unitRepository.releaseWindow).not.toHaveBeenCalled();
  });
});
