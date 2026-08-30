import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { type Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { UnitRepositoryAdapter } from './UnitRepositoryAdapter.js';
import { UnitDocument, UnitSchema } from './unit.schema.js';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';

describe('UnitRepositoryAdapter', () => {
  let connection: Connection;
  let adapter: UnitRepositoryAdapter;

  beforeAll(async () => {
    const uri =
      process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/prueba_test';
    connection = (await mongoose
      .createConnection(uri)
      .asPromise()) as Connection;
    const model = connection.model(UnitDocument.name, UnitSchema);
    adapter = new UnitRepositoryAdapter(model);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await connection.collection('units').deleteMany({});
  });

  it('persists and retrieves a unit', async () => {
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    await adapter.create(unit);

    const found = await adapter.findById(unit.id);
    expect(found?.name).toBe('ABC-123');
    expect(found?.driverName).toBe('Jane Doe');
  });

  it('deletes a unit and returns true; false when already gone', async () => {
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    await adapter.create(unit);

    expect(await adapter.delete(unit.id)).toBe(true);
    expect(await adapter.delete(unit.id)).toBe(false);
  });

  describe('reserveWindow — the race-safety guard', () => {
    it('reserves a window when the unit has no conflicting window', async () => {
      const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
      await adapter.create(unit);

      const reserved = await adapter.reserveWindow(
        unit.id,
        randomUUID(),
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T16:00:00Z'),
      );

      expect(reserved).toBe(true);
    });

    it('rejects a window that overlaps an already-reserved one', async () => {
      const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
      await adapter.create(unit);

      await adapter.reserveWindow(
        unit.id,
        randomUUID(),
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T16:00:00Z'),
      );

      const secondReserved = await adapter.reserveWindow(
        unit.id,
        randomUUID(),
        new Date('2026-01-01T12:00:00Z'), // overlaps the first window
        new Date('2026-01-01T20:00:00Z'),
      );

      expect(secondReserved).toBe(false);
    });

    it('accepts a window that starts exactly when another ends (touching, not overlapping)', async () => {
      const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
      await adapter.create(unit);

      await adapter.reserveWindow(
        unit.id,
        randomUUID(),
        new Date('2026-01-01T08:00:00Z'),
        new Date('2026-01-01T16:00:00Z'),
      );

      const secondReserved = await adapter.reserveWindow(
        unit.id,
        randomUUID(),
        new Date('2026-01-01T16:00:00Z'), // starts exactly when the first ends
        new Date('2026-01-01T20:00:00Z'),
      );

      expect(secondReserved).toBe(true);
    });

    it('releaseWindow frees the slot for a later reservation', async () => {
      const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
      await adapter.create(unit);
      const dutyId = randomUUID();
      const start = new Date('2026-01-01T08:00:00Z');
      const end = new Date('2026-01-01T16:00:00Z');

      await adapter.reserveWindow(unit.id, dutyId, start, end);
      await adapter.releaseWindow(unit.id, dutyId);

      const reservedAgain = await adapter.reserveWindow(
        unit.id,
        randomUUID(),
        start,
        end,
      );
      expect(reservedAgain).toBe(true);
    });

    it('CRITICAL: under concurrent requests for the same overlapping window, exactly one wins', async () => {
      const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
      await adapter.create(unit);

      const start = new Date('2026-01-01T08:00:00Z');
      const end = new Date('2026-01-01T16:00:00Z');

      const results = await Promise.all([
        adapter.reserveWindow(unit.id, randomUUID(), start, end),
        adapter.reserveWindow(unit.id, randomUUID(), start, end),
        adapter.reserveWindow(unit.id, randomUUID(), start, end),
        adapter.reserveWindow(unit.id, randomUUID(), start, end),
        adapter.reserveWindow(unit.id, randomUUID(), start, end),
      ]);

      const wins = results.filter((won) => won).length;
      expect(wins).toBe(1);

      const found = await adapter.findById(unit.id);
      expect(found).not.toBeNull();
    });
  });
});
