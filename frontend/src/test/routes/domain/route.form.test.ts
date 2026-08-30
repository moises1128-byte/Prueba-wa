import { describe, it, expect } from 'vitest';
import { routeFormDefinition } from '@/features/routes/domain/route.form';

describe('routeFormDefinition', () => {
  it('accepts a route with at least one valid point', () => {
    const result = routeFormDefinition.safeParse({
      name: 'Downtown loop',
      points: [{ lat: 10, lng: 20, name: 'Start' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a route with no points', () => {
    const result = routeFormDefinition.safeParse({ name: 'Empty', points: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range latitude', () => {
    const result = routeFormDefinition.safeParse({ points: [{ lat: 200, lng: 20 }] });
    expect(result.success).toBe(false);
  });
});
