import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateUnitUseCase } from './CreateUnitUseCase.js';
import type { UnitRepository } from '../ports/UnitRepository.js';

function mockUnitRepository(): UnitRepository {
  return {
    create: vi.fn(async (unit) => unit),
    update: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    reserveWindow: vi.fn(),
    releaseWindow: vi.fn(),
  };
}

describe('CreateUnitUseCase', () => {
  it('creates a unit with name and driverName', async () => {
    const unitRepository = mockUnitRepository();
    const useCase = new CreateUnitUseCase(unitRepository);

    const result = await useCase.execute({
      name: 'ABC-123',
      driverName: 'Jane Doe',
    });

    expect(unitRepository.create).toHaveBeenCalledOnce();
    expect(result.name).toBe('ABC-123');
    expect(result.driverName).toBe('Jane Doe');
  });
});
