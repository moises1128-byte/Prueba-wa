import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateRouteUseCase } from './CreateRouteUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';

describe('CreateRouteUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: CreateRouteUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(async (route) => route),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new CreateRouteUseCase(routeRepository);
  });

  it('creates a route with the given name and points', async () => {
    const result = await useCase.execute({
      name: 'Centro-Norte',
      points: [{ lat: 1, lng: 1, name: 'A' }],
    });

    expect(routeRepository.create).toHaveBeenCalledOnce();
    expect(result.name).toBe('Centro-Norte');
    expect(result.points).toHaveLength(1);
    expect(result.points[0].name).toBe('A');
  });

  it('creates a route without a name', async () => {
    const result = await useCase.execute({ points: [] });
    expect(result.name).toBeUndefined();
  });
});
