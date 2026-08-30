import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RouteDutyIntegrationResolver } from './RouteDutyIntegration.resolver.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { RouteHasActiveDutiesError } from '../../../route/domain/errors/RouteErrors.js';
import type { GetDutiesByRouteUseCase } from '../../application/use-cases/GetDutiesByRouteUseCase.js';
import type { DeleteRouteUseCase } from '../../../route/application/use-cases/DeleteRouteUseCase.js';

describe('RouteDutyIntegrationResolver', () => {
  let getDutiesByRouteUseCase: Pick<GetDutiesByRouteUseCase, 'execute'>;
  let deleteRouteUseCase: Pick<DeleteRouteUseCase, 'execute'>;
  let resolver: RouteDutyIntegrationResolver;
  let route: Route;
  let unit: Unit;
  let duty: Duty;

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    duty = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    getDutiesByRouteUseCase = { execute: vi.fn() };
    deleteRouteUseCase = { execute: vi.fn() };
    resolver = new RouteDutyIntegrationResolver(
      getDutiesByRouteUseCase as GetDutiesByRouteUseCase,
      deleteRouteUseCase as DeleteRouteUseCase,
    );
  });

  it('duties field resolver returns duties mapped to DutyType', async () => {
    vi.mocked(getDutiesByRouteUseCase.execute).mockResolvedValue([duty]);
    const result = await resolver.duties({ id: route.id.value } as never);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(duty.id.value);
  });

  it('deleteRoute succeeds when the route has no duties', async () => {
    vi.mocked(getDutiesByRouteUseCase.execute).mockResolvedValue([]);
    vi.mocked(deleteRouteUseCase.execute).mockResolvedValue(true);

    const result = await resolver.deleteRoute(route.id.value);
    expect(result).toBe(true);
    expect(deleteRouteUseCase.execute).toHaveBeenCalledWith(route.id.value);
  });

  it('deleteRoute is rejected when the route has active duties', async () => {
    vi.mocked(getDutiesByRouteUseCase.execute).mockResolvedValue([duty]);

    await expect(resolver.deleteRoute(route.id.value)).rejects.toThrow(
      RouteHasActiveDutiesError,
    );
    expect(deleteRouteUseCase.execute).not.toHaveBeenCalled();
  });
});
