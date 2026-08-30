// backend/test/transport-planning.e2e-spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Transport planning (e2e)', () => {
  let app: INestApplication;
  // `@nestjs/mongoose` always connects via `mongoose.createConnection(...)`,
  // never `mongoose.connect(...)`, so the default `mongoose.connection`
  // singleton is never opened. We must fetch the app's actual connection
  // (registered under the default connection token) to talk to the same
  // database the running app uses.
  let connection: Connection;

  beforeAll(async () => {
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/prueba_test';
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await connection.collection('routes').deleteMany({});
    await connection.collection('units').deleteMany({});
    await connection.collection('duties').deleteMany({});
  });

  async function graphql(query: string, variables?: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({ query, variables });
  }

  it('supports the full route → unit → duty → detail-view flow, and rejects overlaps', async () => {
    const routeResponse = await graphql(
      `
        mutation ($input: CreateRouteInput!) {
          createRoute(input: $input) {
            id
            name
            points {
              lat
              lng
              name
            }
          }
        }
      `,
      {
        input: {
          name: 'Centro-Norte',
          points: [{ lat: 10.5, lng: -66.9, name: 'Depot' }],
        },
      },
    );
    expect(routeResponse.body.data.createRoute.points).toHaveLength(1);
    const routeId = routeResponse.body.data.createRoute.id;

    const unitResponse = await graphql(
      `
        mutation ($input: CreateUnitInput!) {
          createUnit(input: $input) {
            id
          }
        }
      `,
      { input: { name: 'ABC-123', driverName: 'Jane Doe' } },
    );
    const unitId = unitResponse.body.data.createUnit.id;

    const createDutyMutation = `mutation($input: CreateDutyInput!) {
      createDuty(input: $input) { id startsAt endsAt route { id } unit { name driverName } }
    }`;

    const firstDuty = await graphql(createDutyMutation, {
      input: {
        routeId,
        unitId,
        startsAt: '2026-01-01T08:00:00.000Z',
        endsAt: '2026-01-01T16:00:00.000Z',
      },
    });
    expect(firstDuty.body.data.createDuty.unit.driverName).toBe('Jane Doe');

    // overlapping window for the same unit — rejected
    const conflicting = await graphql(createDutyMutation, {
      input: {
        routeId,
        unitId,
        startsAt: '2026-01-01T12:00:00.000Z',
        endsAt: '2026-01-01T20:00:00.000Z',
      },
    });
    expect(conflicting.body.errors[0].extensions.code).toBe('dutyOverlap');

    // route detail view: Route.duties resolved field reflects the one successful duty
    const detail = await graphql(
      `
        query ($id: ID!) {
          route(id: $id) {
            id
            duties {
              id
            }
          }
        }
      `,
      {
        id: routeId,
      },
    );
    expect(detail.body.data.route.duties).toHaveLength(1);

    // deleting the route is blocked while it has a duty
    const blockedDelete = await graphql(
      `
        mutation ($id: ID!) {
          deleteRoute(id: $id)
        }
      `,
      { id: routeId },
    );
    expect(blockedDelete.body.errors[0].extensions.code).toBe(
      'routeHasActiveDuties',
    );

    // delete the duty, then the route deletion succeeds
    await graphql(
      `
        mutation ($id: ID!) {
          deleteDuty(id: $id)
        }
      `,
      {
        id: firstDuty.body.data.createDuty.id,
      },
    );
    const allowedDelete = await graphql(
      `
        mutation ($id: ID!) {
          deleteRoute(id: $id)
        }
      `,
      { id: routeId },
    );
    expect(allowedDelete.body.data.deleteRoute).toBe(true);
  });

  it('CRITICAL: rejects all but one duty when two overlapping creations race for the same unit', async () => {
    const routeResponse = await graphql(
      `
        mutation ($input: CreateRouteInput!) {
          createRoute(input: $input) {
            id
          }
        }
      `,
      { input: { points: [{ lat: 0, lng: 0 }] } },
    );
    const routeId = routeResponse.body.data.createRoute.id;

    const unitResponse = await graphql(
      `
        mutation ($input: CreateUnitInput!) {
          createUnit(input: $input) {
            id
          }
        }
      `,
      { input: { name: 'ABC-123', driverName: 'Jane Doe' } },
    );
    const unitId = unitResponse.body.data.createUnit.id;

    const createDutyMutation = `mutation($input: CreateDutyInput!) { createDuty(input: $input) { id } }`;
    const variables = {
      input: {
        routeId,
        unitId,
        startsAt: '2026-01-01T08:00:00.000Z',
        endsAt: '2026-01-01T16:00:00.000Z',
      },
    };

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => graphql(createDutyMutation, variables)),
    );

    const succeeded = responses.filter(
      (response) => response.body.data?.createDuty,
    );
    const conflicted = responses.filter(
      (response) =>
        response.body.errors?.[0]?.extensions?.code === 'dutyOverlap',
    );

    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(4);
  });

  it('updateDuty moves the unit reservation: old window frees, new window blocks', async () => {
    const routeResponse = await graphql(
      `
        mutation ($input: CreateRouteInput!) {
          createRoute(input: $input) {
            id
          }
        }
      `,
      { input: { points: [{ lat: 0, lng: 0 }] } },
    );
    const routeId = routeResponse.body.data.createRoute.id;

    const unitResponse = await graphql(
      `
        mutation ($input: CreateUnitInput!) {
          createUnit(input: $input) {
            id
          }
        }
      `,
      { input: { name: 'ABC-123', driverName: 'Jane Doe' } },
    );
    const unitId = unitResponse.body.data.createUnit.id;

    const createDutyMutation = `mutation($input: CreateDutyInput!) { createDuty(input: $input) { id } }`;
    const created = await graphql(createDutyMutation, {
      input: {
        routeId,
        unitId,
        startsAt: '2026-01-01T08:00:00.000Z',
        endsAt: '2026-01-01T16:00:00.000Z',
      },
    });
    const dutyId = created.body.data.createDuty.id;

    const updateResponse = await graphql(
      `
        mutation ($id: ID!, $input: UpdateDutyInput!) {
          updateDuty(id: $id, input: $input) {
            id
          }
        }
      `,
      {
        id: dutyId,
        input: {
          startsAt: '2026-01-02T08:00:00.000Z',
          endsAt: '2026-01-02T16:00:00.000Z',
        },
      },
    );
    expect(updateResponse.body.data.updateDuty.id).toBe(dutyId);

    // The OLD window is now free.
    const oldWindowDuty = await graphql(createDutyMutation, {
      input: {
        routeId,
        unitId,
        startsAt: '2026-01-01T08:00:00.000Z',
        endsAt: '2026-01-01T16:00:00.000Z',
      },
    });
    expect(oldWindowDuty.body.data.createDuty).toBeTruthy();

    // The NEW window is occupied.
    const newWindowConflict = await graphql(createDutyMutation, {
      input: {
        routeId,
        unitId,
        startsAt: '2026-01-02T12:00:00.000Z',
        endsAt: '2026-01-02T20:00:00.000Z',
      },
    });
    expect(newWindowConflict.body.errors[0].extensions.code).toBe(
      'dutyOverlap',
    );
  });
});
