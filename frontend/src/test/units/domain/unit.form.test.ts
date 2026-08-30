import { describe, it, expect } from 'vitest';
import { unitFormDefinition } from '@/features/units/domain/unit.form';

describe('unitFormDefinition', () => {
  it('accepts a valid unit', () => {
    const result = unitFormDefinition.safeParse({ name: 'Truck 1', driverName: 'Alex' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = unitFormDefinition.safeParse({ name: '', driverName: 'Alex' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty driver name', () => {
    const result = unitFormDefinition.safeParse({ name: 'Truck 1', driverName: '' });
    expect(result.success).toBe(false);
  });
});
