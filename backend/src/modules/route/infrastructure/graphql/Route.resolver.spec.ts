import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RouteResolver } from './Route.resolver.js';
import { Route } from '../../domain/entities/Route.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import type { CreateRouteUseCase } from '../../application/use-cases/CreateRouteUseCase.js';
import type { GetRoutesUseCase } from '../../application/use-cases/GetRoutesUseCase.js';
import type { GetRouteByIdUseCase } from '../../application/use-cases/GetRouteByIdUseCase.js';
import type { UpdateRouteUseCase } from '../../application/use-cases/UpdateRouteUseCase.js';

describe('RouteResolver', () => {
  let resolver: RouteResolver;
  let createRouteUseCase: Pick<CreateRouteUseCase, 'execute'>;
  let getRoutesUseCase: Pick<GetRoutesUseCase, 'execute'>;
  let getRouteByIdUseCase: Pick<GetRouteByIdUseCase, 'execute'>;
  let updateRouteUseCase: Pick<UpdateRouteUseCase, 'execute'>;

  beforeEach(() => {
    createRouteUseCase = { execute: vi.fn() };
    getRoutesUseCase = { execute: vi.fn() };
    getRouteByIdUseCase = { execute: vi.fn() };
    updateRouteUseCase = { execute: vi.fn() };
    resolver = new RouteResolver(
      createRouteUseCase as CreateRouteUseCase,
      getRoutesUseCase as GetRoutesUseCase,
      getRouteByIdUseCase as GetRouteByIdUseCase,
      updateRouteUseCase as UpdateRouteUseCase,
    );
  });

  it('createRoute maps the created domain route to RouteType', async () => {
    const route = Route.restore({
      id: (Route.create({ points: [] }) as Route).id,
      name: 'Centro-Norte',
      points: [RoutePoint.create({ lat: 1, lng: 1 })],
    });
    vi.mocked(createRouteUseCase.execute).mockResolvedValue(route);

    const result = await resolver.createRoute({
      name: 'Centro-Norte',
      points: [{ lat: 1, lng: 1 }],
    });

    expect(result.name).toBe('Centro-Norte');
    expect(result.points).toEqual([{ lat: 1, lng: 1, name: undefined }]);
    expect(result.id).toBe(route.id.value);
  });

  it('routes maps every domain route to RouteType', async () => {
    const routeA = Route.create({ points: [] });
    const routeB = Route.create({ points: [] });
    vi.mocked(getRoutesUseCase.execute).mockResolvedValue([routeA, routeB]);

    const result = await resolver.routes();
    expect(result).toHaveLength(2);
  });

  it('route returns null when not found', async () => {
    vi.mocked(getRouteByIdUseCase.execute).mockResolvedValue(null);
    const result = await resolver.route('missing');
    expect(result).toBeNull();
  });
});
