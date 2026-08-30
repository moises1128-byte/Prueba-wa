import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DutyResolver } from './Duty.resolver.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import type { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase.js';
import type { UpdateDutyUseCase } from '../../application/use-cases/UpdateDutyUseCase.js';
import type { DeleteDutyUseCase } from '../../application/use-cases/DeleteDutyUseCase.js';
import type { GetDutiesUseCase } from '../../application/use-cases/GetDutiesUseCase.js';
import type { GetDutyByIdUseCase } from '../../application/use-cases/GetDutyByIdUseCase.js';
import type { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';

describe('DutyResolver', () => {
  let resolver: DutyResolver;
  let createDutyUseCase: Pick<CreateDutyUseCase, 'execute'>;
  let updateDutyUseCase: Pick<UpdateDutyUseCase, 'execute'>;
  let deleteDutyUseCase: Pick<DeleteDutyUseCase, 'execute'>;
  let getDutiesUseCase: Pick<GetDutiesUseCase, 'execute'>;
  let getDutyByIdUseCase: Pick<GetDutyByIdUseCase, 'execute'>;
  let routeRepository: Pick<RouteRepository, 'findById'>;
  let unitRepository: Pick<UnitRepository, 'findById'>;
  let route: Route;
  let unit: Unit;
  let duty: Duty;

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    duty = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    createDutyUseCase = { execute: vi.fn() };
    updateDutyUseCase = { execute: vi.fn() };
    deleteDutyUseCase = { execute: vi.fn() };
    getDutiesUseCase = { execute: vi.fn() };
    getDutyByIdUseCase = { execute: vi.fn() };
    routeRepository = { findById: vi.fn(async () => route) };
    unitRepository = { findById: vi.fn(async () => unit) };

    resolver = new DutyResolver(
      createDutyUseCase as CreateDutyUseCase,
      updateDutyUseCase as UpdateDutyUseCase,
      deleteDutyUseCase as DeleteDutyUseCase,
      getDutiesUseCase as GetDutiesUseCase,
      getDutyByIdUseCase as GetDutyByIdUseCase,
      routeRepository as RouteRepository,
      unitRepository as UnitRepository,
    );
  });

  it('createDuty maps the created domain duty to DutyType', async () => {
    vi.mocked(createDutyUseCase.execute).mockResolvedValue(duty);

    const result = await resolver.createDuty({
      routeId: route.id.value,
      unitId: unit.id.value,
      startsAt: duty.startsAt,
      endsAt: duty.endsAt,
    });

    expect(result.id).toBe(duty.id.value);
    expect(result.routeId).toBe(route.id.value);
    expect(result.unitId).toBe(unit.id.value);
  });

  it('route field resolver fetches the referenced route via RouteRepository', async () => {
    const dutyType = {
      id: duty.id.value,
      routeId: route.id.value,
      unitId: unit.id.value,
    } as never;
    const result = await resolver.route(dutyType);
    expect(result.id).toBe(route.id.value);
  });

  it('unit field resolver fetches the referenced unit via UnitRepository', async () => {
    const dutyType = {
      id: duty.id.value,
      routeId: route.id.value,
      unitId: unit.id.value,
    } as never;
    const result = await resolver.unit(dutyType);
    expect(result.id).toBe(unit.id.value);
  });
});
