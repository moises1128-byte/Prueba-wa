import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { type Connection } from 'mongoose';
import { DutyRepositoryAdapter } from './DutyRepositoryAdapter.js';
import { DutyDocument, DutySchema } from './duty.schema.js';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

describe('DutyRepositoryAdapter', () => {
  let connection: Connection;
  let adapter: DutyRepositoryAdapter;

  beforeAll(async () => {
    const uri =
      process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/prueba_test';
    connection = (await mongoose
      .createConnection(uri)
      .asPromise()) as Connection;
    const model = connection.model(DutyDocument.name, DutySchema);
    adapter = new DutyRepositoryAdapter(model);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await connection.collection('duties').deleteMany({});
  });

  it('persists and retrieves a duty', async () => {
    const routeId = RouteId.generate();
    const unitId = UnitId.generate();
    const duty = Duty.create({
      routeId,
      unitId,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    await adapter.create(duty);
    const found = await adapter.findById(duty.id);

    expect(found?.routeId.equals(routeId)).toBe(true);
    expect(found?.unitId.equals(unitId)).toBe(true);
    expect(found?.startsAt).toEqual(duty.startsAt);
  });

  it('findByRouteId returns only duties for that route', async () => {
    const routeA = RouteId.generate();
    const routeB = RouteId.generate();
    const unitId = UnitId.generate();

    await adapter.create(
      Duty.create({
        routeId: routeA,
        unitId,
        startsAt: new Date('2026-01-01T08:00:00Z'),
        endsAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
    await adapter.create(
      Duty.create({
        routeId: routeB,
        unitId,
        startsAt: new Date('2026-01-01T12:00:00Z'),
        endsAt: new Date('2026-01-01T14:00:00Z'),
      }),
    );

    const result = await adapter.findByRouteId(routeA);
    expect(result).toHaveLength(1);
    expect(result[0].routeId.equals(routeA)).toBe(true);
  });

  it('findByUnitId returns only duties for that unit', async () => {
    const routeId = RouteId.generate();
    const unitA = UnitId.generate();
    const unitB = UnitId.generate();

    await adapter.create(
      Duty.create({
        routeId,
        unitId: unitA,
        startsAt: new Date('2026-01-01T08:00:00Z'),
        endsAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
    await adapter.create(
      Duty.create({
        routeId,
        unitId: unitB,
        startsAt: new Date('2026-01-01T12:00:00Z'),
        endsAt: new Date('2026-01-01T14:00:00Z'),
      }),
    );

    const result = await adapter.findByUnitId(unitA);
    expect(result).toHaveLength(1);
    expect(result[0].unitId.equals(unitA)).toBe(true);
  });

  it('deletes a duty and returns true; false when already gone', async () => {
    const duty = Duty.create({
      routeId: RouteId.generate(),
      unitId: UnitId.generate(),
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });
    await adapter.create(duty);

    expect(await adapter.delete(duty.id)).toBe(true);
    expect(await adapter.delete(duty.id)).toBe(false);
  });

  it('returns null for a duty that does not exist', async () => {
    expect(await adapter.findById(DutyId.generate())).toBeNull();
  });
});
