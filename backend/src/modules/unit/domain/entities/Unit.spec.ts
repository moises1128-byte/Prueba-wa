import { describe, expect, it } from 'vitest';
import { Unit } from './Unit.js';
import { InvalidUnitError } from '../errors/UnitErrors.js';

describe('Unit', () => {
  it('creates a unit with a name and a driver name', () => {
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    expect(unit.name).toBe('ABC-123');
    expect(unit.driverName).toBe('Jane Doe');
    expect(unit.id.value).toBeTruthy();
  });

  it('rejects an empty name', () => {
    expect(() => Unit.create({ name: '  ', driverName: 'Jane Doe' })).toThrow(
      InvalidUnitError,
    );
  });

  it('rejects an empty driver name', () => {
    expect(() => Unit.create({ name: 'ABC-123', driverName: '  ' })).toThrow(
      InvalidUnitError,
    );
  });

  it('update() returns a new Unit with merged fields, preserving id', () => {
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    const updated = unit.update({ driverName: 'John Smith' });
    expect(updated.id.equals(unit.id)).toBe(true);
    expect(updated.name).toBe('ABC-123');
    expect(updated.driverName).toBe('John Smith');
  });
});
