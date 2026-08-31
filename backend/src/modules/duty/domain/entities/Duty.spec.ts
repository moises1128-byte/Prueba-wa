import { describe, expect, it } from 'vitest';
import { Duty } from './Duty.js';
import { InvalidDutyWindowError } from '../errors/DutyErrors.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

describe('Duty', () => {
  const routeId = RouteId.generate();
  const unitId = UnitId.generate();

  it('creates a duty with a valid window', () => {
    const duty = Duty.create({
      routeId,
      unitId,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });
    expect(duty.routeId.equals(routeId)).toBe(true);
    expect(duty.unitId.equals(unitId)).toBe(true);
  });

  it('rejects a window where endsAt is before startsAt', () => {
    expect(() =>
      Duty.create({
        routeId,
        unitId,
        startsAt: new Date('2026-01-01T16:00:00Z'),
        endsAt: new Date('2026-01-01T08:00:00Z'),
      }),
    ).toThrow(InvalidDutyWindowError);
  });

  it('rejects a window where endsAt equals startsAt', () => {
    const at = new Date('2026-01-01T08:00:00Z');
    expect(() =>
      Duty.create({ routeId, unitId, startsAt: at, endsAt: at }),
    ).toThrow(InvalidDutyWindowError);
  });

  it('update() returns a new Duty with merged fields, preserving id, and re-validates the window', () => {
    const duty = Duty.create({
      routeId,
      unitId,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    const updated = duty.update({ endsAt: new Date('2026-01-01T18:00:00Z') });
    expect(updated.id.equals(duty.id)).toBe(true);
    expect(updated.endsAt).toEqual(new Date('2026-01-01T18:00:00Z'));

    expect(() =>
      duty.update({ endsAt: new Date('2026-01-01T00:00:00Z') }),
    ).toThrow(InvalidDutyWindowError);
  });

  it('description is optional and preserved across update() unless overridden', () => {
    const duty = Duty.create({
      routeId,
      unitId,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
      description: 'Turno matutino',
    });
    expect(duty.description).toBe('Turno matutino');

    const untouched = duty.update({
      endsAt: new Date('2026-01-01T18:00:00Z'),
    });
    expect(untouched.description).toBe('Turno matutino');

    const overridden = duty.update({ description: 'Turno vespertino' });
    expect(overridden.description).toBe('Turno vespertino');
  });
});
