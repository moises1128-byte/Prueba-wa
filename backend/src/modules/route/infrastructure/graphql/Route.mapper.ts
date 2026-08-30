import type { Route } from '../../domain/entities/Route.js';
import type { RouteType } from './Route.object-type.js';

export function toRouteType(route: Route): RouteType {
  return {
    id: route.id.value,
    name: route.name,
    points: route.points.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      name: point.name,
    })),
  };
}
