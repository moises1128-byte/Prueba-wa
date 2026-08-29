import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteRouteUseCase } from './DeleteRouteUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';

describe('DeleteRouteUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: DeleteRouteUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new DeleteRouteUseCase(routeRepository);
  });

  it('deletes an existing route', async () => {
    vi.mocked(routeRepository.delete).mockResolvedValue(true);
    const result = await useCase.execute('some-id');
    expect(result).toBe(true);
  });

  it('throws RouteNotFoundError when the route does not exist', async () => {
    vi.mocked(routeRepository.delete).mockResolvedValue(false);
    await expect(useCase.execute('missing')).rejects.toThrow(
      RouteNotFoundError,
    );
  });
});
