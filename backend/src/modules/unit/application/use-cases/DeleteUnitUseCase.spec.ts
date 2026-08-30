import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteUnitUseCase } from './DeleteUnitUseCase.js';
import type { UnitRepository } from '../ports/UnitRepository.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';

describe('DeleteUnitUseCase', () => {
  let unitRepository: UnitRepository;
  let useCase: DeleteUnitUseCase;

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
    useCase = new DeleteUnitUseCase(unitRepository);
  });

  it('deletes an existing unit', async () => {
    vi.mocked(unitRepository.delete).mockResolvedValue(true);
    expect(await useCase.execute('some-id')).toBe(true);
  });

  it('throws UnitNotFoundError when the unit does not exist', async () => {
    vi.mocked(unitRepository.delete).mockResolvedValue(false);
    await expect(useCase.execute('missing')).rejects.toThrow(UnitNotFoundError);
  });
});
