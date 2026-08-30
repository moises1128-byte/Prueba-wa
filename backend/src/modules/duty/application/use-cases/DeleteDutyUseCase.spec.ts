import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteDutyUseCase } from './DeleteDutyUseCase.js';
import type { DutyRepository } from '../ports/DutyRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { DutyNotFoundError } from '../../domain/errors/DutyErrors.js';

describe('DeleteDutyUseCase', () => {
  let dutyRepository: DutyRepository;
  let unitRepository: UnitRepository;
  let useCase: DeleteDutyUseCase;
  let existing: Duty;

  beforeEach(() => {
    const route = Route.create({ points: [] });
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    existing = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    dutyRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(async () => true),
      findById: vi.fn(async () => existing),
      findAll: vi.fn(),
      findByRouteId: vi.fn(),
      findByUnitId: vi.fn(),
    };
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      reserveWindow: vi.fn(),
      releaseWindow: vi.fn(),
    };
    useCase = new DeleteDutyUseCase(dutyRepository, unitRepository);
  });

  it('releases the window and deletes the duty', async () => {
    const result = await useCase.execute(existing.id.value);
    expect(unitRepository.releaseWindow).toHaveBeenCalledWith(
      existing.unitId,
      existing.id.value,
    );
    expect(dutyRepository.delete).toHaveBeenCalledWith(existing.id);
    expect(result).toBe(true);
  });

  it('throws DutyNotFoundError when the duty does not exist', async () => {
    vi.mocked(dutyRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(DutyNotFoundError);
  });
});
