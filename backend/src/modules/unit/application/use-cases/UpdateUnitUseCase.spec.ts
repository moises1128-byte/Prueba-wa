import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateUnitUseCase } from './UpdateUnitUseCase.js';
import type { UnitRepository } from '../ports/UnitRepository.js';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';

describe('UpdateUnitUseCase', () => {
  let unitRepository: UnitRepository;
  let useCase: UpdateUnitUseCase;

  beforeEach(() => {
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      reserveWindow: vi.fn(),
      releaseWindow: vi.fn(),
    };
    useCase = new UpdateUnitUseCase(unitRepository);
  });

  it('updates an existing unit', async () => {
    const existing = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    vi.mocked(unitRepository.findById).mockResolvedValue(existing);
    vi.mocked(unitRepository.update).mockImplementation(
      async (_id, unit) => unit,
    );

    const result = await useCase.execute(existing.id.value, {
      driverName: 'John Smith',
    });
    expect(result.driverName).toBe('John Smith');
  });

  it('throws UnitNotFoundError when the unit does not exist', async () => {
    vi.mocked(unitRepository.findById).mockResolvedValue(null);
    await expect(
      useCase.execute('missing', { driverName: 'X' }),
    ).rejects.toThrow(UnitNotFoundError);
  });
});
