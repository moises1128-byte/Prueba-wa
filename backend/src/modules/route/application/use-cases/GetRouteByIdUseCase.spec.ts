import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetRouteByIdUseCase } from './GetRouteByIdUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';

describe('GetRouteByIdUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: GetRouteByIdUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new GetRouteByIdUseCase(routeRepository);
  });

  it('returns the route when found', async () => {
    const route = Route.restore({ id: RouteId.generate(), points: [] });
    vi.mocked(routeRepository.findById).mockResolvedValue(route);

    const result = await useCase.execute(route.id.value);
    expect(result).toBe(route);
  });

  it('returns null when not found', async () => {
    vi.mocked(routeRepository.findById).mockResolvedValue(null);
    const result = await useCase.execute('missing');
    expect(result).toBeNull();
  });
});
