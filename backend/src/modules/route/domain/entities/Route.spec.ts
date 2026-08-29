import { describe, expect, it } from 'vitest';
import { Route } from './Route.js';
import { RoutePoint } from '../value-objects/RoutePoint.js';

describe('Route', () => {
  it('creates a route with an ordered list of points', () => {
    const points = [
      RoutePoint.create({ lat: 1, lng: 1 }),
      RoutePoint.create({ lat: 2, lng: 2 }),
    ];
    const route = Route.create({ name: 'Centro-Norte', points });
    expect(route.name).toBe('Centro-Norte');
    expect(route.points).toEqual(points);
    expect(route.id.value).toBeTruthy();
  });

  it('allows an unnamed route', () => {
    const route = Route.create({ points: [] });
    expect(route.name).toBeUndefined();
  });

  it('update() returns a new Route with merged fields, preserving id', () => {
    const route = Route.create({ name: 'Original', points: [] });
    const newPoints = [RoutePoint.create({ lat: 5, lng: 5 })];
    const updated = route.update({ points: newPoints });
    expect(updated.id.equals(route.id)).toBe(true);
    expect(updated.name).toBe('Original');
    expect(updated.points).toEqual(newPoints);
  });
});
