import { describe, it, expect } from 'vitest';
import { dutyFormDefinition } from '@/features/routes/domain/duty.form';

describe('dutyFormDefinition', () => {
  it('accepts a window where endsAt is after startsAt', () => {
    const result = dutyFormDefinition.safeParse({
      unitId: '1',
      startsAt: '2026-09-01T08:00',
      endsAt: '2026-09-01T09:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a window where endsAt is not after startsAt', () => {
    const result = dutyFormDefinition.safeParse({
      unitId: '1',
      startsAt: '2026-09-01T09:00',
      endsAt: '2026-09-01T09:00',
    });
    expect(result.success).toBe(false);
  });
});
