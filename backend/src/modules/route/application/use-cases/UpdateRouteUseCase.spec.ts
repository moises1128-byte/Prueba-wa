import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateRouteUseCase } from './UpdateRouteUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';

describe('UpdateRouteUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: UpdateRouteUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new UpdateRouteUseCase(routeRepository);
  });

  it('updates an existing route', async () => {
    const existing = Route.restore({
      id: RouteId.generate(),
      name: 'Old',
      points: [],
    });
    vi.mocked(routeRepository.findById).mockResolvedValue(existing);
    vi.mocked(routeRepository.update).mockImplementation(
      async (_id, route) => route,
    );

    const result = await useCase.execute(existing.id.value, { name: 'New' });
    expect(result.name).toBe('New');
  });

  it('throws RouteNotFoundError when the route does not exist', async () => {
    vi.mocked(routeRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'New' })).rejects.toThrow(
      RouteNotFoundError,
    );
  });
});
