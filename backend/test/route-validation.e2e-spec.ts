import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Route input validation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function expectNoRouteNamed(name: string): Promise<void> {
    const routesResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({ query: `{ routes { name } }` });

    const names: string[] = routesResponse.body.data.routes.map(
      (route: { name?: string }) => route.name,
    );
    expect(names).not.toContain(name);
  }

  it('rejects createRoute when a point latitude is out of range', async () => {
    const uniqueName = `Invalid lat route ${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: `mutation($input: CreateRouteInput!) {
          createRoute(input: $input) { id name }
        }`,
        variables: {
          input: {
            name: uniqueName,
            points: [{ lat: 999, lng: -66.9 }],
          },
        },
      });

    // GraphQL over HTTP always responds 200; failures live in the `errors` array.
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
    await expectNoRouteNamed(uniqueName);
  });

  it('rejects createRoute when points is empty, a rule only the ValidationPipe enforces', async () => {
    // Route.create() in the domain layer does not itself reject an empty points array
    // (see Route.resolver.spec.ts, which legitimately calls Route.create({ points: [] })).
    // Only CreateRouteInput's @ArrayNotEmpty() decorator rejects it - so this case, unlike
    // out-of-range lat/lng (which the domain's RoutePoint.create() also independently
    // rejects), fails end-to-end if and only if the global ValidationPipe is actually wired
    // up and running against this input.
    const uniqueName = `Empty points route ${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: `mutation($input: CreateRouteInput!) {
          createRoute(input: $input) { id name }
        }`,
        variables: {
          input: {
            name: uniqueName,
            points: [],
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
    await expectNoRouteNamed(uniqueName);
  });
});
