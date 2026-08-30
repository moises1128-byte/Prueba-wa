import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnitDutyIntegrationResolver } from './UnitDutyIntegration.resolver.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { UnitHasActiveDutiesError } from '../../../unit/domain/errors/UnitErrors.js';
import type { GetDutiesByUnitUseCase } from '../../application/use-cases/GetDutiesByUnitUseCase.js';
import type { DeleteUnitUseCase } from '../../../unit/application/use-cases/DeleteUnitUseCase.js';

describe('UnitDutyIntegrationResolver', () => {
  let getDutiesByUnitUseCase: Pick<GetDutiesByUnitUseCase, 'execute'>;
  let deleteUnitUseCase: Pick<DeleteUnitUseCase, 'execute'>;
  let resolver: UnitDutyIntegrationResolver;
  let unit: Unit;
  let duty: Duty;

  beforeEach(() => {
    const route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    duty = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    getDutiesByUnitUseCase = { execute: vi.fn() };
    deleteUnitUseCase = { execute: vi.fn() };
    resolver = new UnitDutyIntegrationResolver(
      getDutiesByUnitUseCase as GetDutiesByUnitUseCase,
      deleteUnitUseCase as DeleteUnitUseCase,
    );
  });

  it('deleteUnit succeeds when the unit has no duties', async () => {
    vi.mocked(getDutiesByUnitUseCase.execute).mockResolvedValue([]);
    vi.mocked(deleteUnitUseCase.execute).mockResolvedValue(true);

    const result = await resolver.deleteUnit(unit.id.value);
    expect(result).toBe(true);
    expect(deleteUnitUseCase.execute).toHaveBeenCalledWith(unit.id.value);
  });

  it('deleteUnit is rejected when the unit has active duties', async () => {
    vi.mocked(getDutiesByUnitUseCase.execute).mockResolvedValue([duty]);

    await expect(resolver.deleteUnit(unit.id.value)).rejects.toThrow(
      UnitHasActiveDutiesError,
    );
    expect(deleteUnitUseCase.execute).not.toHaveBeenCalled();
  });
});
