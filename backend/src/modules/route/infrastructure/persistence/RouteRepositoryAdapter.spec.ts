import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { type Connection } from 'mongoose';
import { RouteRepositoryAdapter } from './RouteRepositoryAdapter.js';
import { RouteDocument, RouteSchema } from './route.schema.js';
import { Route } from '../../domain/entities/Route.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';

describe('RouteRepositoryAdapter', () => {
  let connection: Connection;
  let adapter: RouteRepositoryAdapter;

  beforeAll(async () => {
    const uri =
      process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/prueba_test';
    connection = (await mongoose
      .createConnection(uri)
      .asPromise()) as Connection;
    const model = connection.model(RouteDocument.name, RouteSchema);
    adapter = new RouteRepositoryAdapter(model);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await connection.collection('routes').deleteMany({});
  });

  it('persists and retrieves a route with its points in order', async () => {
    const route = Route.create({
      name: 'Centro-Norte',
      points: [
        RoutePoint.create({ lat: 1, lng: 1, name: 'A' }),
        RoutePoint.create({ lat: 2, lng: 2, name: 'B' }),
      ],
    });

    await adapter.create(route);
    const found = await adapter.findById(route.id);

    expect(found?.name).toBe('Centro-Norte');
    expect(found?.points.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('returns null for a route that does not exist', async () => {
    const found = await adapter.findById(RouteId.generate());
    expect(found).toBeNull();
  });

  it('updates a route', async () => {
    const route = Route.create({ name: 'Original', points: [] });
    await adapter.create(route);

    const updated = route.update({ name: 'Renamed' });
    const saved = await adapter.update(route.id, updated);

    expect(saved?.name).toBe('Renamed');
  });

  it('deletes a route and returns true; returns false when already gone', async () => {
    const route = Route.create({ points: [] });
    await adapter.create(route);

    expect(await adapter.delete(route.id)).toBe(true);
    expect(await adapter.delete(route.id)).toBe(false);
  });

  it('findAll returns every persisted route', async () => {
    await adapter.create(Route.create({ points: [] }));
    await adapter.create(Route.create({ points: [] }));

    const all = await adapter.findAll();
    expect(all).toHaveLength(2);
  });
});
