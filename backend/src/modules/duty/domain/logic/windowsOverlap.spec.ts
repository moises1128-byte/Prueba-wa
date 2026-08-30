import { describe, expect, it } from 'vitest';
import { windowsOverlap } from './windowsOverlap.js';

describe('windowsOverlap', () => {
  it('returns true when windows partially overlap', () => {
    expect(
      windowsOverlap(
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T16:00:00Z'),
        new Date('2026-01-01T12:00:00Z'),
        new Date('2026-01-01T20:00:00Z'),
      ),
    ).toBe(true);
  });

  it('returns true when one window fully contains the other', () => {
    expect(
      windowsOverlap(
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T20:00:00Z'),
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T12:00:00Z'),
      ),
    ).toBe(true);
  });

  it('returns true when windows are identical', () => {
    const start = new Date('2026-01-01T08:00:00Z');
    const end = new Date('2026-01-01T16:00:00Z');
    expect(windowsOverlap(start, end, start, end)).toBe(true);
  });

  it('returns false when windows only touch at the boundary', () => {
    expect(
      windowsOverlap(
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T16:00:00Z'),
        new Date('2026-01-01T16:00:00Z'),
        new Date('2026-01-01T20:00:00Z'),
      ),
    ).toBe(false);
  });

  it('returns false when windows do not overlap at all', () => {
    expect(
      windowsOverlap(
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T10:00:00Z'),
        new Date('2026-01-01T18:00:00Z'),
        new Date('2026-01-01T20:00:00Z'),
      ),
    ).toBe(false);
  });
});
