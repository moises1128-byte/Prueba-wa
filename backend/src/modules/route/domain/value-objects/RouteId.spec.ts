import { describe, expect, it } from 'vitest';
import { RouteId } from './RouteId.js';

describe('RouteId', () => {
  it('generates a unique id each time', () => {
    expect(RouteId.generate().value).not.toBe(RouteId.generate().value);
  });

  it('restores from an existing value', () => {
    expect(RouteId.restore('abc-123').value).toBe('abc-123');
  });

  it('two ids with the same value are equal', () => {
    expect(RouteId.restore('same').equals(RouteId.restore('same'))).toBe(true);
  });
});
