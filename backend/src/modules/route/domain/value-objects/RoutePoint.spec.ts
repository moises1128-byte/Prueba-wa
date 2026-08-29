import { describe, expect, it } from 'vitest';
import { RoutePoint } from './RoutePoint.js';
import { InvalidRoutePointError } from '../errors/RouteErrors.js';

describe('RoutePoint', () => {
  it('creates a valid point', () => {
    const point = RoutePoint.create({ lat: 10.5, lng: -66.9, name: 'Depot' });
    expect(point.lat).toBe(10.5);
    expect(point.lng).toBe(-66.9);
    expect(point.name).toBe('Depot');
  });

  it('allows an unnamed point', () => {
    const point = RoutePoint.create({ lat: 0, lng: 0 });
    expect(point.name).toBeUndefined();
  });

  it('rejects latitude outside [-90, 90]', () => {
    expect(() => RoutePoint.create({ lat: 91, lng: 0 })).toThrow(
      InvalidRoutePointError,
    );
    expect(() => RoutePoint.create({ lat: -91, lng: 0 })).toThrow(
      InvalidRoutePointError,
    );
  });

  it('rejects longitude outside [-180, 180]', () => {
    expect(() => RoutePoint.create({ lat: 0, lng: 181 })).toThrow(
      InvalidRoutePointError,
    );
    expect(() => RoutePoint.create({ lat: 0, lng: -181 })).toThrow(
      InvalidRoutePointError,
    );
  });
});
