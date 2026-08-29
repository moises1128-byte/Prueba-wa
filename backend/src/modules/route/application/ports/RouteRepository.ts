import type { Route } from '../../domain/entities/Route.js';
import type { RouteId } from '../../domain/value-objects/RouteId.js';

export abstract class RouteRepository {
  abstract create(route: Route): Promise<Route>;
  abstract update(id: RouteId, route: Route): Promise<Route | null>;
  abstract delete(id: RouteId): Promise<boolean>;
  abstract findById(id: RouteId): Promise<Route | null>;
  abstract findAll(): Promise<Route[]>;
}
