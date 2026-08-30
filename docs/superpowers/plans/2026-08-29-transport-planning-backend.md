# Transport Planning Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend half of the transport-planning MVP — Route/Unit/Duty modules with a
race-safe overlap guard, exposed over GraphQL, backed by MongoDB.

**Architecture:** Hexagonal architecture per `agent_docs/backend/architecture.md` — three feature
modules (`route`, `unit`, `duty`), each with domain/application/infrastructure zones. `duty`
imports `route` and `unit` (one-directional: it needs their repositories to validate references at
creation time). `route` and `unit` never import `duty` — the two mutations that need
duty-awareness (`deleteRoute`, `deleteUnit`) are resolved by small GraphQL resolvers that live
_inside_ the `duty` module, injecting the (exported) simple delete use-case from `route`/`unit`
plus `duty`'s own repository to run the guard check. This keeps the module graph one-directional
(no `forwardRef`) while still enforcing "can't delete a route/unit with active duties."

**Tech Stack:** NestJS, `@nestjs/graphql` (code-first, Apollo), `@nestjs/mongoose`, MongoDB
(standalone, no replica set), Vitest, oxlint, Prettier — all already scaffolded in `backend/`.

**Spec:** `docs/superpowers/specs/2026-08-29-transport-planning-mvp-design.md`

## Global Constraints

- All file names, function names, class names, and identifiers are in **English** (confirmed
  project convention).
- The project's TypeScript config is `module: nodenext` — **every relative import needs an
  explicit `.js` extension**, even though the source file is `.ts` (e.g.
  `import { Duty } from '../../domain/entities/Duty.js'`). This is already the pattern in
  `backend/src/app.module.ts`. Missing this breaks the build with a module-resolution error, not a
  type error, so it's easy to miss until `pnpm build` is run.
- No `any`, no `as any`. Explicit return types on public methods. See
  `agent_docs/backend/code-standard.md`.
- Domain code (entities, value objects, policies, errors) has zero NestJS/Mongoose/GraphQL
  imports. See `agent_docs/backend/architecture.md`.
- Hard deletes, no soft-delete/`isActive` convention (not required by the spec) — except that
  `deleteRoute`/`deleteUnit` are **rejected outright** (not soft-deleted) when active duties exist.
- Test files are `.spec.ts`, colocated next to the file they test (not in a separate `test/`
  tree) — `backend/vitest.config.ts` already globs `**/*.spec.ts` everywhere. E2E tests go in
  `backend/test/*.e2e-spec.ts` (globbed by `backend/vitest.config.e2e.ts`).
- Run tests from `backend/`: `pnpm test` (unit/integration), `pnpm test:e2e` (E2E), `pnpm build`
  (typecheck), `pnpm lint` (oxlint).
- Integration tests (repository adapters, E2E) run against the real local MongoDB
  (`mongodb://localhost:27017/prueba_test` — a separate test database name so tests never touch
  dev data; see Task 4). If `mongod` isn't running, start it per `README.md`.

---

### Task 1: Global GraphQL error formatting

Wires `DomainError` → GraphQL error `extensions.code` mapping once, globally, per
`agent_docs/backend/error-handling.md`. Every later task's domain errors rely on this.

**Files:**

- Create: `backend/src/shared/errors/domain-error.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/shared/errors/domain-error.spec.ts`

**Interfaces:**

- Produces: `abstract class DomainError extends Error { abstract readonly code: string }` —
  every domain error in every later task extends this.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/shared/errors/domain-error.spec.ts
import { describe, expect, it } from 'vitest';
import { DomainError } from './domain-error.js';

class TestError extends DomainError {
  readonly code = 'testError';
  constructor() {
    super('test message');
  }
}

describe('DomainError', () => {
  it('is an instance of Error with a stable code', () => {
    const error = new TestError();
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('testError');
    expect(error.message).toBe('test message');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `pnpm test domain-error`
Expected: FAIL — `Cannot find module './domain-error.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/shared/errors/domain-error.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test domain-error`
Expected: PASS

- [ ] **Step 5: Wire `formatError` into the GraphQL module**

Read `backend/src/app.module.ts` first (it currently configures `GraphQLModule.forRoot` without
`formatError`). Add the import and the `formatError` option:

```typescript
// backend/src/app.module.ts — add this import near the top
import { DomainError } from './shared/errors/domain-error.js';
```

Inside the existing `GraphQLModule.forRoot<ApolloDriverConfig>({...})` call, add a `formatError`
key alongside `driver`, `autoSchemaFile`, `sortSchema`:

```typescript
      formatError: (formattedError, error) => {
        const original = (error as { originalError?: unknown }).originalError;
        if (original instanceof DomainError) {
          return { message: original.message, extensions: { code: original.code } };
        }
        if (formattedError.extensions?.code === 'BAD_USER_INPUT') {
          return formattedError;
        }
        return { message: 'Internal server error', extensions: { code: 'internalError' } };
      },
```

- [ ] **Step 6: Build to verify wiring compiles**

Run: `pnpm build`
Expected: succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/shared/errors/domain-error.ts backend/src/shared/errors/domain-error.spec.ts backend/src/app.module.ts
git commit -m "feat(backend): add DomainError base class and wire GraphQL error formatting"
```

---

### Task 2: Route domain layer

**Files:**

- Create: `backend/src/modules/route/domain/value-objects/RouteId.ts`
- Create: `backend/src/modules/route/domain/value-objects/RoutePoint.ts`
- Create: `backend/src/modules/route/domain/entities/Route.ts`
- Create: `backend/src/modules/route/domain/errors/RouteErrors.ts`
- Test: `backend/src/modules/route/domain/value-objects/RouteId.spec.ts`
- Test: `backend/src/modules/route/domain/value-objects/RoutePoint.spec.ts`
- Test: `backend/src/modules/route/domain/entities/Route.spec.ts`

**Interfaces:**

- Consumes: `DomainError` from `backend/src/shared/errors/domain-error.js` (Task 1).
- Produces: `RouteId` (`.generate()`, `.restore(value)`, `.value`), `RoutePoint`
  (`.create({lat,lng,name?})`, `.restore(...)`, `.lat`, `.lng`, `.name`), `Route`
  (`.create({name?, points})`, `.restore(props)`, `.id`, `.name`, `.points`, `.update({name?,
points?})`), `RouteNotFoundError`, `InvalidRoutePointError`, `RouteHasActiveDutiesError` — all
  used by every later Route task and by the `duty` module.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/route/domain/value-objects/RouteId.spec.ts
import { describe, expect, it } from 'vitest';
import { RouteId } from './RouteId.js';

describe('RouteId', () => {
  it('generates a unique id each time', () => {
    expect(RouteId.generate().value).not.toBe(RouteId.generate().value);
  });

  it('restores from an existing value', () => {
    expect(RouteId.restore('abc-123').value).toBe('abc-123');
  });

  it('two ids with the same value are equal', () => {
    expect(RouteId.restore('same').equals(RouteId.restore('same'))).toBe(true);
  });
});
```

```typescript
// backend/src/modules/route/domain/value-objects/RoutePoint.spec.ts
import { describe, expect, it } from 'vitest';
import { RoutePoint } from './RoutePoint.js';
import { InvalidRoutePointError } from '../errors/RouteErrors.js';

describe('RoutePoint', () => {
  it('creates a valid point', () => {
    const point = RoutePoint.create({ lat: 10.5, lng: -66.9, name: 'Depot' });
    expect(point.lat).toBe(10.5);
    expect(point.lng).toBe(-66.9);
    expect(point.name).toBe('Depot');
  });

  it('allows an unnamed point', () => {
    const point = RoutePoint.create({ lat: 0, lng: 0 });
    expect(point.name).toBeUndefined();
  });

  it('rejects latitude outside [-90, 90]', () => {
    expect(() => RoutePoint.create({ lat: 91, lng: 0 })).toThrow(
      InvalidRoutePointError,
    );
    expect(() => RoutePoint.create({ lat: -91, lng: 0 })).toThrow(
      InvalidRoutePointError,
    );
  });

  it('rejects longitude outside [-180, 180]', () => {
    expect(() => RoutePoint.create({ lat: 0, lng: 181 })).toThrow(
      InvalidRoutePointError,
    );
    expect(() => RoutePoint.create({ lat: 0, lng: -181 })).toThrow(
      InvalidRoutePointError,
    );
  });
});
```

```typescript
// backend/src/modules/route/domain/entities/Route.spec.ts
import { describe, expect, it } from 'vitest';
import { Route } from './Route.js';
import { RoutePoint } from '../value-objects/RoutePoint.js';

describe('Route', () => {
  it('creates a route with an ordered list of points', () => {
    const points = [
      RoutePoint.create({ lat: 1, lng: 1 }),
      RoutePoint.create({ lat: 2, lng: 2 }),
    ];
    const route = Route.create({ name: 'Centro-Norte', points });
    expect(route.name).toBe('Centro-Norte');
    expect(route.points).toEqual(points);
    expect(route.id.value).toBeTruthy();
  });

  it('allows an unnamed route', () => {
    const route = Route.create({ points: [] });
    expect(route.name).toBeUndefined();
  });

  it('update() returns a new Route with merged fields, preserving id', () => {
    const route = Route.create({ name: 'Original', points: [] });
    const newPoints = [RoutePoint.create({ lat: 5, lng: 5 })];
    const updated = route.update({ points: newPoints });
    expect(updated.id.equals(route.id)).toBe(true);
    expect(updated.name).toBe('Original');
    expect(updated.points).toEqual(newPoints);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test route/domain`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/route/domain/errors/RouteErrors.ts
import { DomainError } from '../../../../shared/errors/domain-error.js';

export class RouteNotFoundError extends DomainError {
  readonly code = 'routeNotFound';
  constructor() {
    super('Route not found');
  }
}

export class InvalidRoutePointError extends DomainError {
  readonly code = 'invalidRoutePoint';
  constructor(reason: string) {
    super(`Invalid route point: ${reason}`);
  }
}

export class RouteHasActiveDutiesError extends DomainError {
  readonly code = 'routeHasActiveDuties';
  constructor() {
    super('Route cannot be deleted while it has duties assigned to it');
  }
}
```

```typescript
// backend/src/modules/route/domain/value-objects/RouteId.ts
import { randomUUID } from 'node:crypto';

export class RouteId {
  private constructor(private readonly _value: string) {}

  static generate(): RouteId {
    return new RouteId(randomUUID());
  }

  static restore(value: string): RouteId {
    return new RouteId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: RouteId): boolean {
    return this._value === other._value;
  }
}
```

```typescript
// backend/src/modules/route/domain/value-objects/RoutePoint.ts
import { InvalidRoutePointError } from '../errors/RouteErrors.js';

export interface RoutePointProps {
  lat: number;
  lng: number;
  name?: string;
}

export class RoutePoint {
  private constructor(private readonly props: RoutePointProps) {}

  static create(props: RoutePointProps): RoutePoint {
    if (props.lat < -90 || props.lat > 90) {
      throw new InvalidRoutePointError('latitude must be between -90 and 90');
    }
    if (props.lng < -180 || props.lng > 180) {
      throw new InvalidRoutePointError(
        'longitude must be between -180 and 180',
      );
    }
    return new RoutePoint(props);
  }

  static restore(props: RoutePointProps): RoutePoint {
    return new RoutePoint(props);
  }

  get lat(): number {
    return this.props.lat;
  }

  get lng(): number {
    return this.props.lng;
  }

  get name(): string | undefined {
    return this.props.name;
  }
}
```

```typescript
// backend/src/modules/route/domain/entities/Route.ts
import { RouteId } from '../value-objects/RouteId.js';
import { RoutePoint } from '../value-objects/RoutePoint.js';

export interface RouteProps {
  id: RouteId;
  name?: string;
  points: RoutePoint[];
}

export class Route {
  private constructor(private readonly props: RouteProps) {}

  static create(props: { name?: string; points: RoutePoint[] }): Route {
    return new Route({
      id: RouteId.generate(),
      name: props.name,
      points: props.points,
    });
  }

  static restore(props: RouteProps): Route {
    return new Route(props);
  }

  get id(): RouteId {
    return this.props.id;
  }

  get name(): string | undefined {
    return this.props.name;
  }

  get points(): RoutePoint[] {
    return this.props.points;
  }

  update(props: { name?: string; points?: RoutePoint[] }): Route {
    return new Route({
      id: this.props.id,
      name: props.name !== undefined ? props.name : this.props.name,
      points: props.points ?? this.props.points,
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test route/domain`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/route/domain
git commit -m "feat(backend): add Route domain layer (entity, value objects, errors)"
```

---

### Task 3: Route application layer

**Files:**

- Create: `backend/src/modules/route/application/ports/RouteRepository.ts`
- Create: `backend/src/modules/route/application/use-cases/CreateRouteUseCase.ts`
- Create: `backend/src/modules/route/application/use-cases/UpdateRouteUseCase.ts`
- Create: `backend/src/modules/route/application/use-cases/DeleteRouteUseCase.ts`
- Create: `backend/src/modules/route/application/use-cases/GetRouteByIdUseCase.ts`
- Create: `backend/src/modules/route/application/use-cases/GetRoutesUseCase.ts`
- Test: `backend/src/modules/route/application/use-cases/CreateRouteUseCase.spec.ts`
- Test: `backend/src/modules/route/application/use-cases/UpdateRouteUseCase.spec.ts`
- Test: `backend/src/modules/route/application/use-cases/DeleteRouteUseCase.spec.ts`
- Test: `backend/src/modules/route/application/use-cases/GetRouteByIdUseCase.spec.ts`

**Interfaces:**

- Consumes: `Route`, `RouteId`, `RoutePoint`, `RouteNotFoundError` (Task 2).
- Produces: `abstract class RouteRepository { create, update, delete, findById, findAll }` — the
  port every `route` GraphQL resolver (Task 5) and the `duty` module (Task 11) inject against.
  `CreateRouteUseCase.execute(input: {name?: string; points: {lat:number; lng:number;
name?:string}[]})`, `UpdateRouteUseCase.execute(id: string, input: {name?: string; points?:
{...}[]})`, `DeleteRouteUseCase.execute(id: string): Promise<boolean>` (simple — no
  duty-awareness, see architecture note in the plan header), `GetRouteByIdUseCase.execute(id:
string): Promise<Route | null>`, `GetRoutesUseCase.execute(): Promise<Route[]>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/route/application/ports/RouteRepository.ts
// (written first, no test needed — it's an abstract class with no behavior of its own)
import type { Route } from '../../domain/entities/Route.js';
import type { RouteId } from '../../domain/value-objects/RouteId.js';

export abstract class RouteRepository {
  abstract create(route: Route): Promise<Route>;
  abstract update(id: RouteId, route: Route): Promise<Route | null>;
  abstract delete(id: RouteId): Promise<boolean>;
  abstract findById(id: RouteId): Promise<Route | null>;
  abstract findAll(): Promise<Route[]>;
}
```

```typescript
// backend/src/modules/route/application/use-cases/CreateRouteUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateRouteUseCase } from './CreateRouteUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';

describe('CreateRouteUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: CreateRouteUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(async (route) => route),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new CreateRouteUseCase(routeRepository);
  });

  it('creates a route with the given name and points', async () => {
    const result = await useCase.execute({
      name: 'Centro-Norte',
      points: [{ lat: 1, lng: 1, name: 'A' }],
    });

    expect(routeRepository.create).toHaveBeenCalledOnce();
    expect(result.name).toBe('Centro-Norte');
    expect(result.points).toHaveLength(1);
    expect(result.points[0].name).toBe('A');
  });

  it('creates a route without a name', async () => {
    const result = await useCase.execute({ points: [] });
    expect(result.name).toBeUndefined();
  });
});
```

```typescript
// backend/src/modules/route/application/use-cases/GetRouteByIdUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetRouteByIdUseCase } from './GetRouteByIdUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';

describe('GetRouteByIdUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: GetRouteByIdUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new GetRouteByIdUseCase(routeRepository);
  });

  it('returns the route when found', async () => {
    const route = Route.restore({ id: RouteId.generate(), points: [] });
    vi.mocked(routeRepository.findById).mockResolvedValue(route);

    const result = await useCase.execute(route.id.value);
    expect(result).toBe(route);
  });

  it('returns null when not found', async () => {
    vi.mocked(routeRepository.findById).mockResolvedValue(null);
    const result = await useCase.execute('missing');
    expect(result).toBeNull();
  });
});
```

```typescript
// backend/src/modules/route/application/use-cases/UpdateRouteUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateRouteUseCase } from './UpdateRouteUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';

describe('UpdateRouteUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: UpdateRouteUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new UpdateRouteUseCase(routeRepository);
  });

  it('updates an existing route', async () => {
    const existing = Route.restore({
      id: RouteId.generate(),
      name: 'Old',
      points: [],
    });
    vi.mocked(routeRepository.findById).mockResolvedValue(existing);
    vi.mocked(routeRepository.update).mockImplementation(
      async (_id, route) => route,
    );

    const result = await useCase.execute(existing.id.value, { name: 'New' });
    expect(result.name).toBe('New');
  });

  it('throws RouteNotFoundError when the route does not exist', async () => {
    vi.mocked(routeRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'New' })).rejects.toThrow(
      RouteNotFoundError,
    );
  });
});
```

```typescript
// backend/src/modules/route/application/use-cases/DeleteRouteUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteRouteUseCase } from './DeleteRouteUseCase.js';
import type { RouteRepository } from '../ports/RouteRepository.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';

describe('DeleteRouteUseCase', () => {
  let routeRepository: RouteRepository;
  let useCase: DeleteRouteUseCase;

  beforeEach(() => {
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
    };
    useCase = new DeleteRouteUseCase(routeRepository);
  });

  it('deletes an existing route', async () => {
    vi.mocked(routeRepository.delete).mockResolvedValue(true);
    const result = await useCase.execute('some-id');
    expect(result).toBe(true);
  });

  it('throws RouteNotFoundError when the route does not exist', async () => {
    vi.mocked(routeRepository.delete).mockResolvedValue(false);
    await expect(useCase.execute('missing')).rejects.toThrow(
      RouteNotFoundError,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test route/application`
Expected: FAIL — use-case modules don't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/route/application/use-cases/CreateRouteUseCase.ts
import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteRepository } from '../ports/RouteRepository.js';

export interface CreateRouteInput {
  name?: string;
  points: { lat: number; lng: number; name?: string }[];
}

@Injectable()
export class CreateRouteUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(input: CreateRouteInput): Promise<Route> {
    const points = input.points.map((point) => RoutePoint.create(point));
    const route = Route.create({ name: input.name, points });
    return this.routeRepository.create(route);
  }
}
```

```typescript
// backend/src/modules/route/application/use-cases/GetRouteByIdUseCase.ts
import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RouteRepository } from '../ports/RouteRepository.js';

@Injectable()
export class GetRouteByIdUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(id: string): Promise<Route | null> {
    return this.routeRepository.findById(RouteId.restore(id));
  }
}
```

```typescript
// backend/src/modules/route/application/use-cases/GetRoutesUseCase.ts
import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RouteRepository } from '../ports/RouteRepository.js';

@Injectable()
export class GetRoutesUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(): Promise<Route[]> {
    return this.routeRepository.findAll();
  }
}
```

```typescript
// backend/src/modules/route/application/use-cases/UpdateRouteUseCase.ts
import { Injectable } from '@nestjs/common';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';
import { RouteRepository } from '../ports/RouteRepository.js';

export interface UpdateRouteInput {
  name?: string;
  points?: { lat: number; lng: number; name?: string }[];
}

@Injectable()
export class UpdateRouteUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(id: string, input: UpdateRouteInput): Promise<Route> {
    const routeId = RouteId.restore(id);
    const existing = await this.routeRepository.findById(routeId);
    if (!existing) throw new RouteNotFoundError();

    const updated = existing.update({
      name: input.name,
      points: input.points?.map((point) => RoutePoint.create(point)),
    });

    const saved = await this.routeRepository.update(routeId, updated);
    if (!saved) throw new RouteNotFoundError();
    return saved;
  }
}
```

```typescript
// backend/src/modules/route/application/use-cases/DeleteRouteUseCase.ts
import { Injectable } from '@nestjs/common';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RouteNotFoundError } from '../../domain/errors/RouteErrors.js';
import { RouteRepository } from '../ports/RouteRepository.js';

@Injectable()
export class DeleteRouteUseCase {
  constructor(private readonly routeRepository: RouteRepository) {}

  async execute(id: string): Promise<boolean> {
    const deleted = await this.routeRepository.delete(RouteId.restore(id));
    if (!deleted) throw new RouteNotFoundError();
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test route/application`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/route/application
git commit -m "feat(backend): add Route application layer (port + use-cases)"
```

---

### Task 4: Route infrastructure — persistence

**Files:**

- Create: `backend/src/modules/route/infrastructure/persistence/route.schema.ts`
- Create: `backend/src/modules/route/infrastructure/persistence/RouteRepositoryAdapter.ts`
- Test: `backend/src/modules/route/infrastructure/persistence/RouteRepositoryAdapter.spec.ts`
- Modify: `backend/.env` and `backend/.env.example` (add `MONGODB_TEST_URI`)

**Interfaces:**

- Consumes: `Route`, `RouteId`, `RoutePoint` (Task 2), `RouteRepository` (Task 3).
- Produces: `RouteDocument`, `RouteSchema` (Mongoose), `RouteRepositoryAdapter implements
RouteRepository` — wired into `route.module.ts` in Task 5.

This task's test hits a **real MongoDB** (not mocked) — it's an integration test for the
persistence adapter, per `agent_docs/backend/testing.md` §5. Add a dedicated test database name so
these tests never collide with dev data:

- [ ] **Step 1: Add a test database URI**

```bash
# backend/.env.example — add this line
MONGODB_TEST_URI=mongodb://localhost:27017/prueba_test
```

```bash
# backend/.env — add the same line (this file is gitignored, but keep it in sync locally)
MONGODB_TEST_URI=mongodb://localhost:27017/prueba_test
```

- [ ] **Step 2: Write the failing test**

```typescript
// backend/src/modules/route/infrastructure/persistence/RouteRepositoryAdapter.spec.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test RouteRepositoryAdapter`
Expected: FAIL — `route.schema.js` / `RouteRepositoryAdapter.js` don't exist.

- [ ] **Step 4: Write the implementation**

```typescript
// backend/src/modules/route/infrastructure/persistence/route.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class RoutePointDocument {
  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lng: number;

  @Prop({ required: false })
  name?: string;
}

export const RoutePointSchema =
  SchemaFactory.createForClass(RoutePointDocument);

@Schema({ collection: 'routes', timestamps: true, _id: false })
export class RouteDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: false })
  name?: string;

  @Prop({ type: [RoutePointSchema], required: true, default: [] })
  points: RoutePointDocument[];
}

export type RouteDocumentType = HydratedDocument<RouteDocument>;
export const RouteSchema = SchemaFactory.createForClass(RouteDocument);
```

```typescript
// backend/src/modules/route/infrastructure/persistence/RouteRepositoryAdapter.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Route } from '../../domain/entities/Route.js';
import { RouteId } from '../../domain/value-objects/RouteId.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import { RouteRepository } from '../../application/ports/RouteRepository.js';
import {
  RouteDocument,
  RouteDocumentType,
  RoutePointDocument,
} from './route.schema.js';

@Injectable()
export class RouteRepositoryAdapter implements RouteRepository {
  constructor(
    @InjectModel(RouteDocument.name)
    private readonly model: Model<RouteDocument>,
  ) {}

  async create(route: Route): Promise<Route> {
    const created = await this.model.create(this.toDocument(route));
    return this.toDomain(created);
  }

  async findById(id: RouteId): Promise<Route | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Route[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: RouteId, route: Route): Promise<Route | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(route), { new: true })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: RouteId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  private toDomain(doc: RouteDocumentType): Route {
    return Route.restore({
      id: RouteId.restore(doc._id),
      name: doc.name,
      points: doc.points.map((point) => RoutePoint.restore(point)),
    });
  }

  private toDocument(route: Route): Partial<RouteDocument> & { _id: string } {
    return {
      _id: route.id.value,
      name: route.name,
      points: route.points.map((point): RoutePointDocument => ({
        lat: point.lat,
        lng: point.lng,
        name: point.name,
      })),
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test RouteRepositoryAdapter`
Expected: PASS (5 tests) — requires `mongod` running locally (see README).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/route/infrastructure/persistence backend/.env.example
git commit -m "feat(backend): add Route Mongoose schema and repository adapter"
```

---

### Task 5: Route GraphQL + module wiring

**Files:**

- Create: `backend/src/modules/route/infrastructure/graphql/Point.object-type.ts`
- Create: `backend/src/modules/route/infrastructure/graphql/Route.object-type.ts`
- Create: `backend/src/modules/route/infrastructure/graphql/PointInput.ts`
- Create: `backend/src/modules/route/infrastructure/graphql/CreateRoute.input.ts`
- Create: `backend/src/modules/route/infrastructure/graphql/UpdateRoute.input.ts`
- Create: `backend/src/modules/route/infrastructure/graphql/Route.mapper.ts`
- Create: `backend/src/modules/route/infrastructure/graphql/Route.resolver.ts`
- Create: `backend/src/modules/route/route.module.ts`
- Test: `backend/src/modules/route/infrastructure/graphql/Route.resolver.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**

- Consumes: all of Route's domain/application/persistence layers (Tasks 2-4).
- Produces: `RouteType`, `PointType` (GraphQL types imported by the `duty` module in Task 13),
  `RouteRepository` and `DeleteRouteUseCase` exported from `RouteModule` (consumed by the `duty`
  module's guard resolver in Task 13).

Note: `RouteResolver` deliberately has **no `deleteRoute` mutation** — that mutation is
implemented in the `duty` module (Task 13), because rejecting the deletion when duties exist
requires knowledge only the `duty` module has. See the plan header's Architecture note.

**Addendum (found during Task 5's review — apply once, here, not in later tasks):** this is the
first task to add `class-validator`/`class-transformer` decorators to an `@InputType()`. Two
things the original plan text omitted:

1. Install the packages: `cd backend && pnpm add class-validator class-transformer`.
2. Register a global `ValidationPipe` in `backend/src/main.ts` — without it, every decorator added
   below (`@IsNumber()`, `@ArrayNotEmpty()`, etc., here and in every later task's inputs) is inert:

```typescript
// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.enableCors();
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
```

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/modules/route/infrastructure/graphql/Route.resolver.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RouteResolver } from './Route.resolver.js';
import { Route } from '../../domain/entities/Route.js';
import { RoutePoint } from '../../domain/value-objects/RoutePoint.js';
import type { CreateRouteUseCase } from '../../application/use-cases/CreateRouteUseCase.js';
import type { GetRoutesUseCase } from '../../application/use-cases/GetRoutesUseCase.js';
import type { GetRouteByIdUseCase } from '../../application/use-cases/GetRouteByIdUseCase.js';
import type { UpdateRouteUseCase } from '../../application/use-cases/UpdateRouteUseCase.js';

describe('RouteResolver', () => {
  let resolver: RouteResolver;
  let createRouteUseCase: Pick<CreateRouteUseCase, 'execute'>;
  let getRoutesUseCase: Pick<GetRoutesUseCase, 'execute'>;
  let getRouteByIdUseCase: Pick<GetRouteByIdUseCase, 'execute'>;
  let updateRouteUseCase: Pick<UpdateRouteUseCase, 'execute'>;

  beforeEach(() => {
    createRouteUseCase = { execute: vi.fn() };
    getRoutesUseCase = { execute: vi.fn() };
    getRouteByIdUseCase = { execute: vi.fn() };
    updateRouteUseCase = { execute: vi.fn() };
    resolver = new RouteResolver(
      createRouteUseCase as CreateRouteUseCase,
      getRoutesUseCase as GetRoutesUseCase,
      getRouteByIdUseCase as GetRouteByIdUseCase,
      updateRouteUseCase as UpdateRouteUseCase,
    );
  });

  it('createRoute maps the created domain route to RouteType', async () => {
    const route = Route.restore({
      id: (Route.create({ points: [] }) as Route).id,
      name: 'Centro-Norte',
      points: [RoutePoint.create({ lat: 1, lng: 1 })],
    });
    vi.mocked(createRouteUseCase.execute).mockResolvedValue(route);

    const result = await resolver.createRoute({
      name: 'Centro-Norte',
      points: [{ lat: 1, lng: 1 }],
    });

    expect(result.name).toBe('Centro-Norte');
    expect(result.points).toEqual([{ lat: 1, lng: 1, name: undefined }]);
    expect(result.id).toBe(route.id.value);
  });

  it('routes maps every domain route to RouteType', async () => {
    const routeA = Route.create({ points: [] });
    const routeB = Route.create({ points: [] });
    vi.mocked(getRoutesUseCase.execute).mockResolvedValue([routeA, routeB]);

    const result = await resolver.routes();
    expect(result).toHaveLength(2);
  });

  it('route returns null when not found', async () => {
    vi.mocked(getRouteByIdUseCase.execute).mockResolvedValue(null);
    const result = await resolver.route('missing');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test Route.resolver`
Expected: FAIL — resolver module doesn't exist.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/route/infrastructure/graphql/Point.object-type.ts
import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType('Point')
export class PointType {
  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field({ nullable: true })
  name?: string;
}
```

```typescript
// backend/src/modules/route/infrastructure/graphql/Route.object-type.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PointType } from './Point.object-type.js';

@ObjectType('Route')
export class RouteType {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => [PointType])
  points: PointType[];
}
```

```typescript
// backend/src/modules/route/infrastructure/graphql/PointInput.ts
import { Field, Float, InputType } from '@nestjs/graphql';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType()
export class PointInput {
  @Field(() => Float)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Field(() => Float)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;
}
```

```typescript
// backend/src/modules/route/infrastructure/graphql/CreateRoute.input.ts
import { Field, InputType } from '@nestjs/graphql';
import {
  ArrayNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PointInput } from './PointInput.js';

@InputType()
export class CreateRouteInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [PointInput])
  @ArrayNotEmpty({ message: 'A route needs at least one point' })
  @ValidateNested({ each: true })
  @Type(() => PointInput)
  points: PointInput[];
}
```

```typescript
// backend/src/modules/route/infrastructure/graphql/UpdateRoute.input.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PointInput } from './PointInput.js';

@InputType()
export class UpdateRouteInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => [PointInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PointInput)
  points?: PointInput[];
}
```

```typescript
// backend/src/modules/route/infrastructure/graphql/Route.mapper.ts
import type { Route } from '../../domain/entities/Route.js';
import type { RouteType } from './Route.object-type.js';

export function toRouteType(route: Route): RouteType {
  return {
    id: route.id.value,
    name: route.name,
    points: route.points.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      name: point.name,
    })),
  };
}
```

```typescript
// backend/src/modules/route/infrastructure/graphql/Route.resolver.ts
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateRouteUseCase } from '../../application/use-cases/CreateRouteUseCase.js';
import { GetRoutesUseCase } from '../../application/use-cases/GetRoutesUseCase.js';
import { GetRouteByIdUseCase } from '../../application/use-cases/GetRouteByIdUseCase.js';
import { UpdateRouteUseCase } from '../../application/use-cases/UpdateRouteUseCase.js';
import { CreateRouteInput } from './CreateRoute.input.js';
import { UpdateRouteInput } from './UpdateRoute.input.js';
import { RouteType } from './Route.object-type.js';
import { toRouteType } from './Route.mapper.js';

@Resolver(() => RouteType)
export class RouteResolver {
  constructor(
    private readonly createRouteUseCase: CreateRouteUseCase,
    private readonly getRoutesUseCase: GetRoutesUseCase,
    private readonly getRouteByIdUseCase: GetRouteByIdUseCase,
    private readonly updateRouteUseCase: UpdateRouteUseCase,
  ) {}

  @Query(() => [RouteType])
  async routes(): Promise<RouteType[]> {
    const routes = await this.getRoutesUseCase.execute();
    return routes.map(toRouteType);
  }

  @Query(() => RouteType, { nullable: true })
  async route(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RouteType | null> {
    const route = await this.getRouteByIdUseCase.execute(id);
    return route ? toRouteType(route) : null;
  }

  @Mutation(() => RouteType)
  async createRoute(
    @Args('input') input: CreateRouteInput,
  ): Promise<RouteType> {
    const route = await this.createRouteUseCase.execute(input);
    return toRouteType(route);
  }

  @Mutation(() => RouteType)
  async updateRoute(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRouteInput,
  ): Promise<RouteType> {
    const route = await this.updateRouteUseCase.execute(id, input);
    return toRouteType(route);
  }
}
```

```typescript
// backend/src/modules/route/route.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RouteDocument,
  RouteSchema,
} from './infrastructure/persistence/route.schema.js';
import { RouteRepositoryAdapter } from './infrastructure/persistence/RouteRepositoryAdapter.js';
import { RouteRepository } from './application/ports/RouteRepository.js';
import { CreateRouteUseCase } from './application/use-cases/CreateRouteUseCase.js';
import { UpdateRouteUseCase } from './application/use-cases/UpdateRouteUseCase.js';
import { DeleteRouteUseCase } from './application/use-cases/DeleteRouteUseCase.js';
import { GetRouteByIdUseCase } from './application/use-cases/GetRouteByIdUseCase.js';
import { GetRoutesUseCase } from './application/use-cases/GetRoutesUseCase.js';
import { RouteResolver } from './infrastructure/graphql/Route.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RouteDocument.name, schema: RouteSchema },
    ]),
  ],
  providers: [
    { provide: RouteRepository, useClass: RouteRepositoryAdapter },
    CreateRouteUseCase,
    UpdateRouteUseCase,
    DeleteRouteUseCase,
    GetRouteByIdUseCase,
    GetRoutesUseCase,
    RouteResolver,
  ],
  exports: [RouteRepository, DeleteRouteUseCase],
})
export class RouteModule {}
```

- [ ] **Step 4: Register `RouteModule` in `app.module.ts`**

```typescript
// backend/src/app.module.ts — add the import
import { RouteModule } from './modules/route/route.module.js';
```

Add `RouteModule` to the `imports` array (alongside `ConfigModule`, `GraphQLModule`,
`MongooseModule`).

- [ ] **Step 5: Run test to verify it passes, then build**

Run: `pnpm test Route.resolver` — expect PASS (3 tests).
Run: `pnpm build` — expect success (this is the point where a missing `.js` extension anywhere in
the chain would surface as a build error).

- [ ] **Step 6: Manual smoke check**

Start the backend (`pnpm start:dev`) and open `http://localhost:3001/graphql` in a browser
(Apollo Sandbox). Run:

```graphql
mutation {
  createRoute(
    input: {
      name: "Centro-Norte"
      points: [{ lat: 10.5, lng: -66.9, name: "Depot" }]
    }
  ) {
    id
    name
    points {
      lat
      lng
      name
    }
  }
}
```

Expected: a `Route` object back with a generated `id`. Then run `{ routes { id name } }` and
confirm it appears.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/route/infrastructure/graphql backend/src/modules/route/route.module.ts backend/src/app.module.ts
git commit -m "feat(backend): add Route GraphQL surface and wire RouteModule"
```

---

### Task 6: Unit domain layer

**Files:**

- Create: `backend/src/modules/unit/domain/value-objects/UnitId.ts`
- Create: `backend/src/modules/unit/domain/entities/Unit.ts`
- Create: `backend/src/modules/unit/domain/errors/UnitErrors.ts`
- Test: `backend/src/modules/unit/domain/entities/Unit.spec.ts`

**Interfaces:**

- Produces: `UnitId`, `Unit` (`.create({name, driverName})`, `.restore(props)`, `.id`, `.name`,
  `.driverName`, `.update({name?, driverName?})`), `UnitNotFoundError`,
  `UnitHasActiveDutiesError`, `InvalidUnitError`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/modules/unit/domain/entities/Unit.spec.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test unit/domain`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/unit/domain/errors/UnitErrors.ts
import { DomainError } from '../../../../shared/errors/domain-error.js';

export class UnitNotFoundError extends DomainError {
  readonly code = 'unitNotFound';
  constructor() {
    super('Unit not found');
  }
}

export class InvalidUnitError extends DomainError {
  readonly code = 'invalidUnit';
  constructor(reason: string) {
    super(`Invalid unit: ${reason}`);
  }
}

export class UnitHasActiveDutiesError extends DomainError {
  readonly code = 'unitHasActiveDuties';
  constructor() {
    super('Unit cannot be deleted while it has duties assigned to it');
  }
}
```

```typescript
// backend/src/modules/unit/domain/value-objects/UnitId.ts
import { randomUUID } from 'node:crypto';

export class UnitId {
  private constructor(private readonly _value: string) {}

  static generate(): UnitId {
    return new UnitId(randomUUID());
  }

  static restore(value: string): UnitId {
    return new UnitId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: UnitId): boolean {
    return this._value === other._value;
  }
}
```

```typescript
// backend/src/modules/unit/domain/entities/Unit.ts
import { UnitId } from '../value-objects/UnitId.js';
import { InvalidUnitError } from '../errors/UnitErrors.js';

export interface UnitProps {
  id: UnitId;
  name: string;
  driverName: string;
}

function assertNonBlank(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new InvalidUnitError(`${field} is required`);
}

export class Unit {
  private constructor(private readonly props: UnitProps) {}

  static create(props: { name: string; driverName: string }): Unit {
    assertNonBlank(props.name, 'name');
    assertNonBlank(props.driverName, 'driverName');
    return new Unit({
      id: UnitId.generate(),
      name: props.name,
      driverName: props.driverName,
    });
  }

  static restore(props: UnitProps): Unit {
    return new Unit(props);
  }

  get id(): UnitId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get driverName(): string {
    return this.props.driverName;
  }

  update(props: { name?: string; driverName?: string }): Unit {
    const name = props.name ?? this.props.name;
    const driverName = props.driverName ?? this.props.driverName;
    assertNonBlank(name, 'name');
    assertNonBlank(driverName, 'driverName');
    return new Unit({ id: this.props.id, name, driverName });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test unit/domain`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/unit/domain
git commit -m "feat(backend): add Unit domain layer (entity, value object, errors)"
```

---

### Task 7: Unit application layer

**Files:**

- Create: `backend/src/modules/unit/application/ports/UnitRepository.ts`
- Create: `backend/src/modules/unit/application/use-cases/CreateUnitUseCase.ts`
- Create: `backend/src/modules/unit/application/use-cases/UpdateUnitUseCase.ts`
- Create: `backend/src/modules/unit/application/use-cases/DeleteUnitUseCase.ts`
- Create: `backend/src/modules/unit/application/use-cases/GetUnitByIdUseCase.ts`
- Create: `backend/src/modules/unit/application/use-cases/GetUnitsUseCase.ts`
- Test: `backend/src/modules/unit/application/use-cases/CreateUnitUseCase.spec.ts`
- Test: `backend/src/modules/unit/application/use-cases/UpdateUnitUseCase.spec.ts`
- Test: `backend/src/modules/unit/application/use-cases/DeleteUnitUseCase.spec.ts`

**Interfaces:**

- Produces: `abstract class UnitRepository { create, update, delete, findById, findAll,
reserveWindow(unitId: UnitId, dutyId: string, startsAt: Date, endsAt: Date): Promise<boolean>,
releaseWindow(unitId: UnitId, dutyId: string): Promise<void> }`. `reserveWindow`/`releaseWindow`
  take `dutyId` as a plain `string` (not a `DutyId` value object) so this port has no compile-time
  dependency on the `duty` module — see the spec's note in §3 about `busyWindows` being an
  infrastructure-only concern. `CreateUnitUseCase`, `UpdateUnitUseCase`, `DeleteUnitUseCase`
  (simple, no duty-awareness — same reasoning as `DeleteRouteUseCase`), `GetUnitByIdUseCase`,
  `GetUnitsUseCase` — all consumed by the Unit resolver (Task 9) and, for the repository port, by
  the `duty` module (Task 11).

- [ ] **Step 1: Write the port and the failing tests**

```typescript
// backend/src/modules/unit/application/ports/UnitRepository.ts
import type { Unit } from '../../domain/entities/Unit.js';
import type { UnitId } from '../../domain/value-objects/UnitId.js';

export abstract class UnitRepository {
  abstract create(unit: Unit): Promise<Unit>;
  abstract update(id: UnitId, unit: Unit): Promise<Unit | null>;
  abstract delete(id: UnitId): Promise<boolean>;
  abstract findById(id: UnitId): Promise<Unit | null>;
  abstract findAll(): Promise<Unit[]>;
  /** Atomically records a busy window for this unit if — and only if — it does not overlap any
   * existing window. Returns false on conflict (no write happened). See spec §3. */
  abstract reserveWindow(
    unitId: UnitId,
    dutyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean>;
  abstract releaseWindow(unitId: UnitId, dutyId: string): Promise<void>;
}
```

```typescript
// backend/src/modules/unit/application/use-cases/CreateUnitUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateUnitUseCase } from './CreateUnitUseCase.js';
import type { UnitRepository } from '../ports/UnitRepository.js';

function mockUnitRepository(): UnitRepository {
  return {
    create: vi.fn(async (unit) => unit),
    update: vi.fn(),
    delete: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    reserveWindow: vi.fn(),
    releaseWindow: vi.fn(),
  };
}

describe('CreateUnitUseCase', () => {
  it('creates a unit with name and driverName', async () => {
    const unitRepository = mockUnitRepository();
    const useCase = new CreateUnitUseCase(unitRepository);

    const result = await useCase.execute({
      name: 'ABC-123',
      driverName: 'Jane Doe',
    });

    expect(unitRepository.create).toHaveBeenCalledOnce();
    expect(result.name).toBe('ABC-123');
    expect(result.driverName).toBe('Jane Doe');
  });
});
```

```typescript
// backend/src/modules/unit/application/use-cases/UpdateUnitUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateUnitUseCase } from './UpdateUnitUseCase.js';
import type { UnitRepository } from '../ports/UnitRepository.js';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';

describe('UpdateUnitUseCase', () => {
  let unitRepository: UnitRepository;
  let useCase: UpdateUnitUseCase;

  beforeEach(() => {
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      reserveWindow: vi.fn(),
      releaseWindow: vi.fn(),
    };
    useCase = new UpdateUnitUseCase(unitRepository);
  });

  it('updates an existing unit', async () => {
    const existing = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    vi.mocked(unitRepository.findById).mockResolvedValue(existing);
    vi.mocked(unitRepository.update).mockImplementation(
      async (_id, unit) => unit,
    );

    const result = await useCase.execute(existing.id.value, {
      driverName: 'John Smith',
    });
    expect(result.driverName).toBe('John Smith');
  });

  it('throws UnitNotFoundError when the unit does not exist', async () => {
    vi.mocked(unitRepository.findById).mockResolvedValue(null);
    await expect(
      useCase.execute('missing', { driverName: 'X' }),
    ).rejects.toThrow(UnitNotFoundError);
  });
});
```

```typescript
// backend/src/modules/unit/application/use-cases/DeleteUnitUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteUnitUseCase } from './DeleteUnitUseCase.js';
import type { UnitRepository } from '../ports/UnitRepository.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';

describe('DeleteUnitUseCase', () => {
  let unitRepository: UnitRepository;
  let useCase: DeleteUnitUseCase;

  beforeEach(() => {
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      reserveWindow: vi.fn(),
      releaseWindow: vi.fn(),
    };
    useCase = new DeleteUnitUseCase(unitRepository);
  });

  it('deletes an existing unit', async () => {
    vi.mocked(unitRepository.delete).mockResolvedValue(true);
    expect(await useCase.execute('some-id')).toBe(true);
  });

  it('throws UnitNotFoundError when the unit does not exist', async () => {
    vi.mocked(unitRepository.delete).mockResolvedValue(false);
    await expect(useCase.execute('missing')).rejects.toThrow(UnitNotFoundError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test unit/application`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/unit/application/use-cases/CreateUnitUseCase.ts
import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitRepository } from '../ports/UnitRepository.js';

export interface CreateUnitInput {
  name: string;
  driverName: string;
}

@Injectable()
export class CreateUnitUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(input: CreateUnitInput): Promise<Unit> {
    const unit = Unit.create(input);
    return this.unitRepository.create(unit);
  }
}
```

```typescript
// backend/src/modules/unit/application/use-cases/GetUnitByIdUseCase.ts
import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitRepository } from '../ports/UnitRepository.js';

@Injectable()
export class GetUnitByIdUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(id: string): Promise<Unit | null> {
    return this.unitRepository.findById(UnitId.restore(id));
  }
}
```

```typescript
// backend/src/modules/unit/application/use-cases/GetUnitsUseCase.ts
import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitRepository } from '../ports/UnitRepository.js';

@Injectable()
export class GetUnitsUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(): Promise<Unit[]> {
    return this.unitRepository.findAll();
  }
}
```

```typescript
// backend/src/modules/unit/application/use-cases/UpdateUnitUseCase.ts
import { Injectable } from '@nestjs/common';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';
import { UnitRepository } from '../ports/UnitRepository.js';

export interface UpdateUnitInput {
  name?: string;
  driverName?: string;
}

@Injectable()
export class UpdateUnitUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(id: string, input: UpdateUnitInput): Promise<Unit> {
    const unitId = UnitId.restore(id);
    const existing = await this.unitRepository.findById(unitId);
    if (!existing) throw new UnitNotFoundError();

    const updated = existing.update(input);
    const saved = await this.unitRepository.update(unitId, updated);
    if (!saved) throw new UnitNotFoundError();
    return saved;
  }
}
```

```typescript
// backend/src/modules/unit/application/use-cases/DeleteUnitUseCase.ts
import { Injectable } from '@nestjs/common';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitNotFoundError } from '../../domain/errors/UnitErrors.js';
import { UnitRepository } from '../ports/UnitRepository.js';

@Injectable()
export class DeleteUnitUseCase {
  constructor(private readonly unitRepository: UnitRepository) {}

  async execute(id: string): Promise<boolean> {
    const deleted = await this.unitRepository.delete(UnitId.restore(id));
    if (!deleted) throw new UnitNotFoundError();
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test unit/application`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/unit/application
git commit -m "feat(backend): add Unit application layer (port + use-cases)"
```

---

### Task 8: Unit infrastructure — persistence, including the atomic overlap guard

**This is the most important task in the plan** — it implements the race-safe mechanism from
spec §3.

**Files:**

- Create: `backend/src/modules/unit/infrastructure/persistence/unit.schema.ts`
- Create: `backend/src/modules/unit/infrastructure/persistence/UnitRepositoryAdapter.ts`
- Test: `backend/src/modules/unit/infrastructure/persistence/UnitRepositoryAdapter.spec.ts`

**Interfaces:**

- Consumes: `Unit`, `UnitId` (Task 6), `UnitRepository` (Task 7).
- Produces: `UnitDocument`, `UnitSchema` — wired into `unit.module.ts` in Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/unit/infrastructure/persistence/UnitRepositoryAdapter.spec.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test UnitRepositoryAdapter`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/unit/infrastructure/persistence/unit.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class BusyWindowDocument {
  @Prop({ type: String, required: true })
  dutyId: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;
}

export const BusyWindowSchema =
  SchemaFactory.createForClass(BusyWindowDocument);

@Schema({ collection: 'units', timestamps: true, _id: false })
export class UnitDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  driverName: string;

  /** Internal, infrastructure-only field — not part of the domain Unit entity or the GraphQL
   * Unit type. Exists solely so `reserveWindow` can enforce the no-overlap invariant with a
   * single atomic `findOneAndUpdate`. See agent_docs/backend/architecture.md and spec §3. */
  @Prop({ type: [BusyWindowSchema], required: true, default: [] })
  busyWindows: BusyWindowDocument[];
}

export type UnitDocumentType = HydratedDocument<UnitDocument>;
export const UnitSchema = SchemaFactory.createForClass(UnitDocument);
```

```typescript
// backend/src/modules/unit/infrastructure/persistence/UnitRepositoryAdapter.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Unit } from '../../domain/entities/Unit.js';
import { UnitId } from '../../domain/value-objects/UnitId.js';
import { UnitRepository } from '../../application/ports/UnitRepository.js';
import { UnitDocument, UnitDocumentType } from './unit.schema.js';

@Injectable()
export class UnitRepositoryAdapter implements UnitRepository {
  constructor(
    @InjectModel(UnitDocument.name) private readonly model: Model<UnitDocument>,
  ) {}

  async create(unit: Unit): Promise<Unit> {
    const created = await this.model.create(this.toDocument(unit));
    return this.toDomain(created);
  }

  async findById(id: UnitId): Promise<Unit | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Unit[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: UnitId, unit: Unit): Promise<Unit | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(unit), { returnDocument: 'after' })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: UnitId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  async reserveWindow(
    unitId: UnitId,
    dutyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean> {
    const result = await this.model
      .findOneAndUpdate(
        {
          _id: unitId.value,
          busyWindows: {
            $not: {
              $elemMatch: {
                startsAt: { $lt: endsAt },
                endsAt: { $gt: startsAt },
              },
            },
          },
        },
        { $push: { busyWindows: { dutyId, startsAt, endsAt } } },
      )
      .exec();
    return result !== null;
  }

  async releaseWindow(unitId: UnitId, dutyId: string): Promise<void> {
    await this.model
      .updateOne({ _id: unitId.value }, { $pull: { busyWindows: { dutyId } } })
      .exec();
  }

  private toDomain(doc: UnitDocumentType): Unit {
    return Unit.restore({
      id: UnitId.restore(doc._id),
      name: doc.name,
      driverName: doc.driverName,
    });
  }

  private toDocument(unit: Unit): Partial<UnitDocument> & { _id: string } {
    return { _id: unit.id.value, name: unit.name, driverName: unit.driverName };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test UnitRepositoryAdapter`
Expected: PASS (7 tests) — the last one (`CRITICAL: under concurrent requests...`) is the direct
evidence for the assessment's core requirement. If it's flaky or fails, do not "fix" it by adding
a retry loop or a delay — it means the `findOneAndUpdate` query is wrong (check that
`$not`/`$elemMatch` is written exactly as above), not that the DB needs help.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/unit/infrastructure/persistence
git commit -m "feat(backend): add Unit persistence with atomic overlap-safe window reservation"
```

---

### Task 9: Unit GraphQL + module wiring

**Files:**

- Create: `backend/src/modules/unit/infrastructure/graphql/Unit.object-type.ts`
- Create: `backend/src/modules/unit/infrastructure/graphql/CreateUnit.input.ts`
- Create: `backend/src/modules/unit/infrastructure/graphql/UpdateUnit.input.ts`
- Create: `backend/src/modules/unit/infrastructure/graphql/Unit.mapper.ts`
- Create: `backend/src/modules/unit/infrastructure/graphql/Unit.resolver.ts`
- Create: `backend/src/modules/unit/unit.module.ts`
- Test: `backend/src/modules/unit/infrastructure/graphql/Unit.resolver.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**

- Produces: `UnitType` (imported by the `duty` module in Task 13), `UnitRepository` and
  `DeleteUnitUseCase` exported from `UnitModule`.

Same reasoning as Task 5: `UnitResolver` has **no `deleteUnit` mutation** — that lives in the
`duty` module (Task 13).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/modules/unit/infrastructure/graphql/Unit.resolver.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnitResolver } from './Unit.resolver.js';
import { Unit } from '../../domain/entities/Unit.js';
import type { CreateUnitUseCase } from '../../application/use-cases/CreateUnitUseCase.js';
import type { GetUnitsUseCase } from '../../application/use-cases/GetUnitsUseCase.js';
import type { GetUnitByIdUseCase } from '../../application/use-cases/GetUnitByIdUseCase.js';
import type { UpdateUnitUseCase } from '../../application/use-cases/UpdateUnitUseCase.js';

describe('UnitResolver', () => {
  let resolver: UnitResolver;
  let createUnitUseCase: Pick<CreateUnitUseCase, 'execute'>;
  let getUnitsUseCase: Pick<GetUnitsUseCase, 'execute'>;
  let getUnitByIdUseCase: Pick<GetUnitByIdUseCase, 'execute'>;
  let updateUnitUseCase: Pick<UpdateUnitUseCase, 'execute'>;

  beforeEach(() => {
    createUnitUseCase = { execute: vi.fn() };
    getUnitsUseCase = { execute: vi.fn() };
    getUnitByIdUseCase = { execute: vi.fn() };
    updateUnitUseCase = { execute: vi.fn() };
    resolver = new UnitResolver(
      createUnitUseCase as CreateUnitUseCase,
      getUnitsUseCase as GetUnitsUseCase,
      getUnitByIdUseCase as GetUnitByIdUseCase,
      updateUnitUseCase as UpdateUnitUseCase,
    );
  });

  it('createUnit maps the created domain unit to UnitType', async () => {
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    vi.mocked(createUnitUseCase.execute).mockResolvedValue(unit);

    const result = await resolver.createUnit({
      name: 'ABC-123',
      driverName: 'Jane Doe',
    });

    expect(result.id).toBe(unit.id.value);
    expect(result.name).toBe('ABC-123');
    expect(result.driverName).toBe('Jane Doe');
  });

  it('units maps every domain unit to UnitType', async () => {
    vi.mocked(getUnitsUseCase.execute).mockResolvedValue([
      Unit.create({ name: 'A', driverName: 'X' }),
      Unit.create({ name: 'B', driverName: 'Y' }),
    ]);
    expect(await resolver.units()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test Unit.resolver`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/unit/infrastructure/graphql/Unit.object-type.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Unit')
export class UnitType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  driverName: string;
}
```

```typescript
// backend/src/modules/unit/infrastructure/graphql/CreateUnit.input.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateUnitInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Driver name is required' })
  driverName: string;
}
```

```typescript
// backend/src/modules/unit/infrastructure/graphql/UpdateUnit.input.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateUnitInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Driver name cannot be empty' })
  driverName?: string;
}
```

```typescript
// backend/src/modules/unit/infrastructure/graphql/Unit.mapper.ts
import type { Unit } from '../../domain/entities/Unit.js';
import type { UnitType } from './Unit.object-type.js';

export function toUnitType(unit: Unit): UnitType {
  return { id: unit.id.value, name: unit.name, driverName: unit.driverName };
}
```

```typescript
// backend/src/modules/unit/infrastructure/graphql/Unit.resolver.ts
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateUnitUseCase } from '../../application/use-cases/CreateUnitUseCase.js';
import { GetUnitsUseCase } from '../../application/use-cases/GetUnitsUseCase.js';
import { GetUnitByIdUseCase } from '../../application/use-cases/GetUnitByIdUseCase.js';
import { UpdateUnitUseCase } from '../../application/use-cases/UpdateUnitUseCase.js';
import { CreateUnitInput } from './CreateUnit.input.js';
import { UpdateUnitInput } from './UpdateUnit.input.js';
import { UnitType } from './Unit.object-type.js';
import { toUnitType } from './Unit.mapper.js';

@Resolver(() => UnitType)
export class UnitResolver {
  constructor(
    private readonly createUnitUseCase: CreateUnitUseCase,
    private readonly getUnitsUseCase: GetUnitsUseCase,
    private readonly getUnitByIdUseCase: GetUnitByIdUseCase,
    private readonly updateUnitUseCase: UpdateUnitUseCase,
  ) {}

  @Query(() => [UnitType])
  async units(): Promise<UnitType[]> {
    const units = await this.getUnitsUseCase.execute();
    return units.map(toUnitType);
  }

  @Query(() => UnitType, { nullable: true })
  async unit(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<UnitType | null> {
    const unit = await this.getUnitByIdUseCase.execute(id);
    return unit ? toUnitType(unit) : null;
  }

  @Mutation(() => UnitType)
  async createUnit(@Args('input') input: CreateUnitInput): Promise<UnitType> {
    const unit = await this.createUnitUseCase.execute(input);
    return toUnitType(unit);
  }

  @Mutation(() => UnitType)
  async updateUnit(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUnitInput,
  ): Promise<UnitType> {
    const unit = await this.updateUnitUseCase.execute(id, input);
    return toUnitType(unit);
  }
}
```

```typescript
// backend/src/modules/unit/unit.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UnitDocument,
  UnitSchema,
} from './infrastructure/persistence/unit.schema.js';
import { UnitRepositoryAdapter } from './infrastructure/persistence/UnitRepositoryAdapter.js';
import { UnitRepository } from './application/ports/UnitRepository.js';
import { CreateUnitUseCase } from './application/use-cases/CreateUnitUseCase.js';
import { UpdateUnitUseCase } from './application/use-cases/UpdateUnitUseCase.js';
import { DeleteUnitUseCase } from './application/use-cases/DeleteUnitUseCase.js';
import { GetUnitByIdUseCase } from './application/use-cases/GetUnitByIdUseCase.js';
import { GetUnitsUseCase } from './application/use-cases/GetUnitsUseCase.js';
import { UnitResolver } from './infrastructure/graphql/Unit.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UnitDocument.name, schema: UnitSchema },
    ]),
  ],
  providers: [
    { provide: UnitRepository, useClass: UnitRepositoryAdapter },
    CreateUnitUseCase,
    UpdateUnitUseCase,
    DeleteUnitUseCase,
    GetUnitByIdUseCase,
    GetUnitsUseCase,
    UnitResolver,
  ],
  exports: [UnitRepository, DeleteUnitUseCase],
})
export class UnitModule {}
```

- [ ] **Step 4: Register `UnitModule` in `app.module.ts`**

```typescript
// backend/src/app.module.ts
import { UnitModule } from './modules/unit/unit.module.js';
```

Add `UnitModule` to the `imports` array.

- [ ] **Step 5: Run tests, then build**

Run: `pnpm test Unit.resolver` — PASS (2 tests).
Run: `pnpm build` — success.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/unit/infrastructure/graphql backend/src/modules/unit/unit.module.ts backend/src/app.module.ts
git commit -m "feat(backend): add Unit GraphQL surface and wire UnitModule"
```

---

### Task 10: Duty domain layer

**Files:**

- Create: `backend/src/modules/duty/domain/logic/windowsOverlap.ts`
- Create: `backend/src/modules/duty/domain/value-objects/DutyId.ts`
- Create: `backend/src/modules/duty/domain/entities/Duty.ts`
- Create: `backend/src/modules/duty/domain/errors/DutyErrors.ts`
- Test: `backend/src/modules/duty/domain/logic/windowsOverlap.spec.ts`
- Test: `backend/src/modules/duty/domain/entities/Duty.spec.ts`

**Interfaces:**

- Consumes: `RouteId` (from `route` module — a plain value object, no DI involved), `UnitId`
  (from `unit` module).
- Produces: `windowsOverlap(aStart, aEnd, bStart, bEnd): boolean`, `DutyId`, `Duty`
  (`.create({routeId, unitId, startsAt, endsAt})`, `.restore(props)`, `.id`, `.routeId`,
  `.unitId`, `.startsAt`, `.endsAt`, `.update({routeId?, unitId?, startsAt?, endsAt?})`),
  `InvalidDutyWindowError`, `DutyNotFoundError`, `DutyOverlapError`.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/duty/domain/logic/windowsOverlap.spec.ts
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
```

```typescript
// backend/src/modules/duty/domain/entities/Duty.spec.ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test duty/domain`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/duty/domain/logic/windowsOverlap.ts
/**
 * Pure predicate mirroring the MongoDB `$elemMatch` filter used by
 * UnitRepositoryAdapter.reserveWindow (startsAt < end && endsAt > start). Not called by the
 * create/update duty path itself — that path relies on the atomic DB-level guard for the actual
 * race-safe enforcement (see spec §3) — this function exists as a tested, documented reference of
 * the same semantics, reusable by any future feature that needs to compare windows in plain
 * application code (e.g. a conflict-visualization view).
 */
export function windowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
```

```typescript
// backend/src/modules/duty/domain/errors/DutyErrors.ts
import { DomainError } from '../../../../shared/errors/domain-error.js';

export class DutyNotFoundError extends DomainError {
  readonly code = 'dutyNotFound';
  constructor() {
    super('Duty not found');
  }
}

export class InvalidDutyWindowError extends DomainError {
  readonly code = 'invalidDutyWindow';
  constructor() {
    super('A duty window must end after it starts');
  }
}

export class DutyOverlapError extends DomainError {
  readonly code = 'dutyOverlap';
  constructor() {
    super('This unit already has a duty during the requested window');
  }
}
```

```typescript
// backend/src/modules/duty/domain/value-objects/DutyId.ts
import { randomUUID } from 'node:crypto';

export class DutyId {
  private constructor(private readonly _value: string) {}

  static generate(): DutyId {
    return new DutyId(randomUUID());
  }

  static restore(value: string): DutyId {
    return new DutyId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: DutyId): boolean {
    return this._value === other._value;
  }
}
```

```typescript
// backend/src/modules/duty/domain/entities/Duty.ts
import { DutyId } from '../value-objects/DutyId.js';
import { InvalidDutyWindowError } from '../errors/DutyErrors.js';
import type { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import type { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

export interface DutyProps {
  id: DutyId;
  routeId: RouteId;
  unitId: UnitId;
  startsAt: Date;
  endsAt: Date;
}

function assertValidWindow(startsAt: Date, endsAt: Date): void {
  if (endsAt <= startsAt) throw new InvalidDutyWindowError();
}

export class Duty {
  private constructor(private readonly props: DutyProps) {}

  static create(props: {
    routeId: RouteId;
    unitId: UnitId;
    startsAt: Date;
    endsAt: Date;
  }): Duty {
    assertValidWindow(props.startsAt, props.endsAt);
    return new Duty({ id: DutyId.generate(), ...props });
  }

  static restore(props: DutyProps): Duty {
    return new Duty(props);
  }

  get id(): DutyId {
    return this.props.id;
  }

  get routeId(): RouteId {
    return this.props.routeId;
  }

  get unitId(): UnitId {
    return this.props.unitId;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }

  update(props: {
    routeId?: RouteId;
    unitId?: UnitId;
    startsAt?: Date;
    endsAt?: Date;
  }): Duty {
    const next: DutyProps = {
      id: this.props.id,
      routeId: props.routeId ?? this.props.routeId,
      unitId: props.unitId ?? this.props.unitId,
      startsAt: props.startsAt ?? this.props.startsAt,
      endsAt: props.endsAt ?? this.props.endsAt,
    };
    assertValidWindow(next.startsAt, next.endsAt);
    return new Duty(next);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test duty/domain`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/duty/domain
git commit -m "feat(backend): add Duty domain layer (entity, windowsOverlap, errors)"
```

---

### Task 11: Duty application layer

**Files:**

- Create: `backend/src/modules/duty/application/ports/DutyRepository.ts`
- Create: `backend/src/modules/duty/application/use-cases/CreateDutyUseCase.ts`
- Create: `backend/src/modules/duty/application/use-cases/UpdateDutyUseCase.ts`
- Create: `backend/src/modules/duty/application/use-cases/DeleteDutyUseCase.ts`
- Create: `backend/src/modules/duty/application/use-cases/GetDutyByIdUseCase.ts`
- Create: `backend/src/modules/duty/application/use-cases/GetDutiesUseCase.ts`
- Create: `backend/src/modules/duty/application/use-cases/GetDutiesByRouteUseCase.ts`
- Create: `backend/src/modules/duty/application/use-cases/GetDutiesByUnitUseCase.ts`
- Test: `backend/src/modules/duty/application/use-cases/CreateDutyUseCase.spec.ts`
- Test: `backend/src/modules/duty/application/use-cases/UpdateDutyUseCase.spec.ts`
- Test: `backend/src/modules/duty/application/use-cases/DeleteDutyUseCase.spec.ts`

**Interfaces:**

- Consumes: `RouteRepository` (route module, Task 3), `UnitRepository` (unit module, Task 7),
  `Duty`, `DutyId` (Task 10).
- Produces: `abstract class DutyRepository { create, update, delete, findById, findAll,
findByRouteId, findByUnitId }`. `CreateDutyUseCase.execute(input: {routeId, unitId, startsAt,
endsAt})`, `UpdateDutyUseCase.execute(id, input)`, `DeleteDutyUseCase.execute(id)`,
  `GetDutyByIdUseCase.execute(id)`, `GetDutiesUseCase.execute()`,
  `GetDutiesByRouteUseCase.execute(routeId)` — consumed by the `duty` module's own `Route.duties`
  field resolver in Task 13 — and `GetDutiesByUnitUseCase.execute(unitId)`, consumed by the
  `deleteUnit` guard in Task 13 (mirrors `GetDutiesByRouteUseCase`'s role for `deleteRoute`, for
  the same architectural reasons).

- [ ] **Step 1: Write the port and the failing tests**

```typescript
// backend/src/modules/duty/application/ports/DutyRepository.ts
import type { Duty } from '../../domain/entities/Duty.js';
import type { DutyId } from '../../domain/value-objects/DutyId.js';
import type { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import type { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

export abstract class DutyRepository {
  abstract create(duty: Duty): Promise<Duty>;
  abstract update(id: DutyId, duty: Duty): Promise<Duty | null>;
  abstract delete(id: DutyId): Promise<boolean>;
  abstract findById(id: DutyId): Promise<Duty | null>;
  abstract findAll(): Promise<Duty[]>;
  abstract findByRouteId(routeId: RouteId): Promise<Duty[]>;
  abstract findByUnitId(unitId: UnitId): Promise<Duty[]>;
}
```

```typescript
// backend/src/modules/duty/application/use-cases/CreateDutyUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CreateDutyUseCase } from './CreateDutyUseCase.js';
import type { DutyRepository } from '../ports/DutyRepository.js';
import type { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';
import { DutyOverlapError } from '../../domain/errors/DutyErrors.js';

describe('CreateDutyUseCase', () => {
  let dutyRepository: DutyRepository;
  let routeRepository: RouteRepository;
  let unitRepository: UnitRepository;
  let useCase: CreateDutyUseCase;
  let route: Route;
  let unit: Unit;

  const input = {
    startsAt: new Date('2026-01-01T08:00:00Z'),
    endsAt: new Date('2026-01-01T16:00:00Z'),
  };

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });

    dutyRepository = {
      create: vi.fn(async (duty) => duty),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      findByRouteId: vi.fn(),
      findByUnitId: vi.fn(),
    };
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(async () => route),
      findAll: vi.fn(),
    };
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(async () => unit),
      findAll: vi.fn(),
      reserveWindow: vi.fn(async () => true),
      releaseWindow: vi.fn(),
    };
    useCase = new CreateDutyUseCase(
      dutyRepository,
      routeRepository,
      unitRepository,
    );
  });

  it('creates a duty when the route and unit exist and the window is free', async () => {
    const result = await useCase.execute({
      routeId: route.id.value,
      unitId: unit.id.value,
      ...input,
    });

    expect(unitRepository.reserveWindow).toHaveBeenCalledOnce();
    expect(dutyRepository.create).toHaveBeenCalledOnce();
    expect(result.routeId.equals(route.id)).toBe(true);
  });

  it('throws RouteNotFoundError when the route does not exist', async () => {
    vi.mocked(routeRepository.findById).mockResolvedValue(null);
    await expect(
      useCase.execute({ routeId: 'missing', unitId: unit.id.value, ...input }),
    ).rejects.toThrow(RouteNotFoundError);
    expect(unitRepository.reserveWindow).not.toHaveBeenCalled();
  });

  it('throws UnitNotFoundError when the unit does not exist', async () => {
    vi.mocked(unitRepository.findById).mockResolvedValue(null);
    await expect(
      useCase.execute({ routeId: route.id.value, unitId: 'missing', ...input }),
    ).rejects.toThrow(UnitNotFoundError);
  });

  it('throws DutyOverlapError when the window guard rejects the reservation', async () => {
    vi.mocked(unitRepository.reserveWindow).mockResolvedValue(false);
    await expect(
      useCase.execute({
        routeId: route.id.value,
        unitId: unit.id.value,
        ...input,
      }),
    ).rejects.toThrow(DutyOverlapError);
    expect(dutyRepository.create).not.toHaveBeenCalled();
  });

  it('releases the reserved window if persisting the duty fails', async () => {
    vi.mocked(dutyRepository.create).mockRejectedValue(new Error('db down'));

    await expect(
      useCase.execute({
        routeId: route.id.value,
        unitId: unit.id.value,
        ...input,
      }),
    ).rejects.toThrow('db down');
    expect(unitRepository.releaseWindow).toHaveBeenCalledOnce();
  });
});
```

```typescript
// backend/src/modules/duty/application/use-cases/UpdateDutyUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdateDutyUseCase } from './UpdateDutyUseCase.js';
import type { DutyRepository } from '../ports/DutyRepository.js';
import type { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import {
  DutyOverlapError,
  DutyNotFoundError,
} from '../../domain/errors/DutyErrors.js';

describe('UpdateDutyUseCase', () => {
  let dutyRepository: DutyRepository;
  let routeRepository: RouteRepository;
  let unitRepository: UnitRepository;
  let useCase: UpdateDutyUseCase;
  let route: Route;
  let unit: Unit;
  let existing: Duty;

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    existing = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    dutyRepository = {
      create: vi.fn(),
      update: vi.fn(async (_id, duty) => duty),
      delete: vi.fn(),
      findById: vi.fn(async () => existing),
      findAll: vi.fn(),
      findByRouteId: vi.fn(),
      findByUnitId: vi.fn(),
    };
    routeRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(async () => route),
      findAll: vi.fn(),
    };
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(async () => unit),
      findAll: vi.fn(),
      reserveWindow: vi.fn(async () => true),
      releaseWindow: vi.fn(),
    };
    useCase = new UpdateDutyUseCase(
      dutyRepository,
      routeRepository,
      unitRepository,
    );
  });

  it('releases the old window and reserves the new one', async () => {
    const newEnd = new Date('2026-01-01T18:00:00Z');
    await useCase.execute(existing.id.value, { endsAt: newEnd });

    expect(unitRepository.releaseWindow).toHaveBeenCalledWith(
      unit.id,
      existing.id.value,
    );
    expect(unitRepository.reserveWindow).toHaveBeenCalledWith(
      unit.id,
      existing.id.value,
      existing.startsAt,
      newEnd,
    );
  });

  it('throws DutyNotFoundError when the duty does not exist', async () => {
    vi.mocked(dutyRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing', {})).rejects.toThrow(
      DutyNotFoundError,
    );
  });

  it('reverts the old window and throws DutyOverlapError when the new window conflicts', async () => {
    vi.mocked(unitRepository.reserveWindow).mockResolvedValueOnce(false); // the new-window attempt fails

    await expect(
      useCase.execute(existing.id.value, {
        endsAt: new Date('2026-01-01T20:00:00Z'),
      }),
    ).rejects.toThrow(DutyOverlapError);

    // reverted: reserveWindow called a second time with the ORIGINAL window
    expect(unitRepository.reserveWindow).toHaveBeenCalledTimes(2);
    expect(unitRepository.reserveWindow).toHaveBeenLastCalledWith(
      unit.id,
      existing.id.value,
      existing.startsAt,
      existing.endsAt,
    );
    expect(dutyRepository.update).not.toHaveBeenCalled();
  });
});
```

```typescript
// backend/src/modules/duty/application/use-cases/DeleteDutyUseCase.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DeleteDutyUseCase } from './DeleteDutyUseCase.js';
import type { DutyRepository } from '../ports/DutyRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { DutyNotFoundError } from '../../domain/errors/DutyErrors.js';

describe('DeleteDutyUseCase', () => {
  let dutyRepository: DutyRepository;
  let unitRepository: UnitRepository;
  let useCase: DeleteDutyUseCase;
  let existing: Duty;

  beforeEach(() => {
    const route = Route.create({ points: [] });
    const unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    existing = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    dutyRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(async () => true),
      findById: vi.fn(async () => existing),
      findAll: vi.fn(),
      findByRouteId: vi.fn(),
      findByUnitId: vi.fn(),
    };
    unitRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      reserveWindow: vi.fn(),
      releaseWindow: vi.fn(),
    };
    useCase = new DeleteDutyUseCase(dutyRepository, unitRepository);
  });

  it('releases the window and deletes the duty', async () => {
    const result = await useCase.execute(existing.id.value);
    expect(unitRepository.releaseWindow).toHaveBeenCalledWith(
      existing.unitId,
      existing.id.value,
    );
    expect(dutyRepository.delete).toHaveBeenCalledWith(existing.id);
    expect(result).toBe(true);
  });

  it('throws DutyNotFoundError when the duty does not exist', async () => {
    vi.mocked(dutyRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(DutyNotFoundError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test duty/application`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/duty/application/use-cases/CreateDutyUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyOverlapError } from '../../domain/errors/DutyErrors.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';

export interface CreateDutyInput {
  routeId: string;
  unitId: string;
  startsAt: Date;
  endsAt: Date;
}

@Injectable()
export class CreateDutyUseCase {
  constructor(
    private readonly dutyRepository: DutyRepository,
    private readonly routeRepository: RouteRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  async execute(input: CreateDutyInput): Promise<Duty> {
    const routeId = RouteId.restore(input.routeId);
    const unitId = UnitId.restore(input.unitId);

    const route = await this.routeRepository.findById(routeId);
    if (!route) throw new RouteNotFoundError();

    const unit = await this.unitRepository.findById(unitId);
    if (!unit) throw new UnitNotFoundError();

    const duty = Duty.create({
      routeId,
      unitId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    const reserved = await this.unitRepository.reserveWindow(
      unitId,
      duty.id.value,
      duty.startsAt,
      duty.endsAt,
    );
    if (!reserved) throw new DutyOverlapError();

    try {
      return await this.dutyRepository.create(duty);
    } catch (error) {
      await this.unitRepository.releaseWindow(unitId, duty.id.value);
      throw error;
    }
  }
}
```

```typescript
// backend/src/modules/duty/application/use-cases/UpdateDutyUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import {
  DutyNotFoundError,
  DutyOverlapError,
} from '../../domain/errors/DutyErrors.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';

export interface UpdateDutyInput {
  routeId?: string;
  unitId?: string;
  startsAt?: Date;
  endsAt?: Date;
}

@Injectable()
export class UpdateDutyUseCase {
  constructor(
    private readonly dutyRepository: DutyRepository,
    private readonly routeRepository: RouteRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  async execute(id: string, input: UpdateDutyInput): Promise<Duty> {
    const dutyId = DutyId.restore(id);
    const existing = await this.dutyRepository.findById(dutyId);
    if (!existing) throw new DutyNotFoundError();

    const nextRouteId = input.routeId
      ? RouteId.restore(input.routeId)
      : existing.routeId;
    const nextUnitId = input.unitId
      ? UnitId.restore(input.unitId)
      : existing.unitId;

    if (input.routeId) {
      const route = await this.routeRepository.findById(nextRouteId);
      if (!route) throw new RouteNotFoundError();
    }
    if (input.unitId) {
      const unit = await this.unitRepository.findById(nextUnitId);
      if (!unit) throw new UnitNotFoundError();
    }

    const updated = existing.update({
      routeId: nextRouteId,
      unitId: nextUnitId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    await this.unitRepository.releaseWindow(existing.unitId, existing.id.value);

    const reserved = await this.unitRepository.reserveWindow(
      updated.unitId,
      updated.id.value,
      updated.startsAt,
      updated.endsAt,
    );
    if (!reserved) {
      // revert — restore the original window so the duty isn't silently left unprotected
      await this.unitRepository.reserveWindow(
        existing.unitId,
        existing.id.value,
        existing.startsAt,
        existing.endsAt,
      );
      throw new DutyOverlapError();
    }

    const saved = await this.dutyRepository.update(dutyId, updated);
    if (!saved) throw new DutyNotFoundError();
    return saved;
  }
}
```

```typescript
// backend/src/modules/duty/application/use-cases/DeleteDutyUseCase.ts
import { Injectable } from '@nestjs/common';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { DutyNotFoundError } from '../../domain/errors/DutyErrors.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';

@Injectable()
export class DeleteDutyUseCase {
  constructor(
    private readonly dutyRepository: DutyRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  async execute(id: string): Promise<boolean> {
    const dutyId = DutyId.restore(id);
    const existing = await this.dutyRepository.findById(dutyId);
    if (!existing) throw new DutyNotFoundError();

    await this.unitRepository.releaseWindow(existing.unitId, dutyId.value);
    await this.dutyRepository.delete(dutyId);
    return true;
  }
}
```

```typescript
// backend/src/modules/duty/application/use-cases/GetDutyByIdUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { DutyRepository } from '../ports/DutyRepository.js';

@Injectable()
export class GetDutyByIdUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(id: string): Promise<Duty | null> {
    return this.dutyRepository.findById(DutyId.restore(id));
  }
}
```

```typescript
// backend/src/modules/duty/application/use-cases/GetDutiesUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyRepository } from '../ports/DutyRepository.js';

@Injectable()
export class GetDutiesUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(): Promise<Duty[]> {
    return this.dutyRepository.findAll();
  }
}
```

```typescript
// backend/src/modules/duty/application/use-cases/GetDutiesByRouteUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';

@Injectable()
export class GetDutiesByRouteUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(routeId: string): Promise<Duty[]> {
    return this.dutyRepository.findByRouteId(RouteId.restore(routeId));
  }
}
```

```typescript
// backend/src/modules/duty/application/use-cases/GetDutiesByUnitUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyRepository } from '../ports/DutyRepository.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

@Injectable()
export class GetDutiesByUnitUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(unitId: string): Promise<Duty[]> {
    return this.dutyRepository.findByUnitId(UnitId.restore(unitId));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test duty/application`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/duty/application
git commit -m "feat(backend): add Duty application layer with cross-module validation and the overlap guard integration"
```

---

### Task 12: Duty infrastructure — persistence

**Files:**

- Create: `backend/src/modules/duty/infrastructure/persistence/duty.schema.ts`
- Create: `backend/src/modules/duty/infrastructure/persistence/DutyRepositoryAdapter.ts`
- Test: `backend/src/modules/duty/infrastructure/persistence/DutyRepositoryAdapter.spec.ts`

**Interfaces:**

- Consumes: `Duty`, `DutyId` (Task 10), `DutyRepository` (Task 11), `RouteId` (route module),
  `UnitId` (unit module).
- Produces: `DutyDocument`, `DutySchema` — wired into `duty.module.ts` in Task 13.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/modules/duty/infrastructure/persistence/DutyRepositoryAdapter.spec.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test DutyRepositoryAdapter`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/duty/infrastructure/persistence/duty.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'duties', timestamps: true, _id: false })
export class DutyDocument {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  routeId: string;

  @Prop({ type: String, required: true })
  unitId: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;
}

export type DutyDocumentType = HydratedDocument<DutyDocument>;
export const DutySchema = SchemaFactory.createForClass(DutyDocument);
```

```typescript
// backend/src/modules/duty/infrastructure/persistence/DutyRepositoryAdapter.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Duty } from '../../domain/entities/Duty.js';
import { DutyId } from '../../domain/value-objects/DutyId.js';
import { DutyRepository } from '../../application/ports/DutyRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { DutyDocument, DutyDocumentType } from './duty.schema.js';

@Injectable()
export class DutyRepositoryAdapter implements DutyRepository {
  constructor(
    @InjectModel(DutyDocument.name) private readonly model: Model<DutyDocument>,
  ) {}

  async create(duty: Duty): Promise<Duty> {
    const created = await this.model.create(this.toDocument(duty));
    return this.toDomain(created);
  }

  async findById(id: DutyId): Promise<Duty | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findAll(): Promise<Duty[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByRouteId(routeId: RouteId): Promise<Duty[]> {
    const docs = await this.model.find({ routeId: routeId.value }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByUnitId(unitId: UnitId): Promise<Duty[]> {
    const docs = await this.model.find({ unitId: unitId.value }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: DutyId, duty: Duty): Promise<Duty | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(duty), { returnDocument: 'after' })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: DutyId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  private toDomain(doc: DutyDocumentType): Duty {
    return Duty.restore({
      id: DutyId.restore(doc._id),
      routeId: RouteId.restore(doc.routeId),
      unitId: UnitId.restore(doc.unitId),
      startsAt: doc.startsAt,
      endsAt: doc.endsAt,
    });
  }

  private toDocument(duty: Duty): Partial<DutyDocument> & { _id: string } {
    return {
      _id: duty.id.value,
      routeId: duty.routeId.value,
      unitId: duty.unitId.value,
      startsAt: duty.startsAt,
      endsAt: duty.endsAt,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test DutyRepositoryAdapter`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/duty/infrastructure/persistence
git commit -m "feat(backend): add Duty Mongoose schema and repository adapter"
```

---

### Task 13: Duty GraphQL + cross-module guard resolvers + module wiring

**Files:**

- Create: `backend/src/modules/duty/infrastructure/graphql/Duty.object-type.ts`
- Create: `backend/src/modules/duty/infrastructure/graphql/CreateDuty.input.ts`
- Create: `backend/src/modules/duty/infrastructure/graphql/UpdateDuty.input.ts`
- Create: `backend/src/modules/duty/infrastructure/graphql/Duty.mapper.ts`
- Create: `backend/src/modules/duty/infrastructure/graphql/Duty.resolver.ts`
- Create: `backend/src/modules/duty/infrastructure/graphql/RouteDutyIntegration.resolver.ts`
- Create: `backend/src/modules/duty/infrastructure/graphql/UnitDutyIntegration.resolver.ts`
- Create: `backend/src/modules/duty/duty.module.ts`
- Test: `backend/src/modules/duty/infrastructure/graphql/Duty.resolver.spec.ts`
- Test: `backend/src/modules/duty/infrastructure/graphql/RouteDutyIntegration.resolver.spec.ts`
- Test: `backend/src/modules/duty/infrastructure/graphql/UnitDutyIntegration.resolver.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**

- Consumes: `RouteType` (route module), `UnitType` (unit module), `DeleteRouteUseCase` (exported
  from `RouteModule`), `DeleteUnitUseCase` (exported from `UnitModule`), everything from Tasks
  10-12.
- Produces: the full `Duty`, `deleteRoute`, `deleteUnit` GraphQL surface.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/modules/duty/infrastructure/graphql/Duty.resolver.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DutyResolver } from './Duty.resolver.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import type { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase.js';
import type { UpdateDutyUseCase } from '../../application/use-cases/UpdateDutyUseCase.js';
import type { DeleteDutyUseCase } from '../../application/use-cases/DeleteDutyUseCase.js';
import type { GetDutiesUseCase } from '../../application/use-cases/GetDutiesUseCase.js';
import type { GetDutyByIdUseCase } from '../../application/use-cases/GetDutyByIdUseCase.js';
import type { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import type { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';

describe('DutyResolver', () => {
  let resolver: DutyResolver;
  let createDutyUseCase: Pick<CreateDutyUseCase, 'execute'>;
  let updateDutyUseCase: Pick<UpdateDutyUseCase, 'execute'>;
  let deleteDutyUseCase: Pick<DeleteDutyUseCase, 'execute'>;
  let getDutiesUseCase: Pick<GetDutiesUseCase, 'execute'>;
  let getDutyByIdUseCase: Pick<GetDutyByIdUseCase, 'execute'>;
  let routeRepository: Pick<RouteRepository, 'findById'>;
  let unitRepository: Pick<UnitRepository, 'findById'>;
  let route: Route;
  let unit: Unit;
  let duty: Duty;

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    duty = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    createDutyUseCase = { execute: vi.fn() };
    updateDutyUseCase = { execute: vi.fn() };
    deleteDutyUseCase = { execute: vi.fn() };
    getDutiesUseCase = { execute: vi.fn() };
    getDutyByIdUseCase = { execute: vi.fn() };
    routeRepository = { findById: vi.fn(async () => route) };
    unitRepository = { findById: vi.fn(async () => unit) };

    resolver = new DutyResolver(
      createDutyUseCase as CreateDutyUseCase,
      updateDutyUseCase as UpdateDutyUseCase,
      deleteDutyUseCase as DeleteDutyUseCase,
      getDutiesUseCase as GetDutiesUseCase,
      getDutyByIdUseCase as GetDutyByIdUseCase,
      routeRepository as RouteRepository,
      unitRepository as UnitRepository,
    );
  });

  it('createDuty maps the created domain duty to DutyType', async () => {
    vi.mocked(createDutyUseCase.execute).mockResolvedValue(duty);

    const result = await resolver.createDuty({
      routeId: route.id.value,
      unitId: unit.id.value,
      startsAt: duty.startsAt,
      endsAt: duty.endsAt,
    });

    expect(result.id).toBe(duty.id.value);
    expect(result.routeId).toBe(route.id.value);
    expect(result.unitId).toBe(unit.id.value);
  });

  it('route field resolver fetches the referenced route via RouteRepository', async () => {
    const dutyType = {
      id: duty.id.value,
      routeId: route.id.value,
      unitId: unit.id.value,
    } as never;
    const result = await resolver.route(dutyType);
    expect(result.id).toBe(route.id.value);
  });

  it('unit field resolver fetches the referenced unit via UnitRepository', async () => {
    const dutyType = {
      id: duty.id.value,
      routeId: route.id.value,
      unitId: unit.id.value,
    } as never;
    const result = await resolver.unit(dutyType);
    expect(result.id).toBe(unit.id.value);
  });
});
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/RouteDutyIntegration.resolver.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RouteDutyIntegrationResolver } from './RouteDutyIntegration.resolver.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { RouteHasActiveDutiesError } from '../../../route/domain/errors/RouteErrors.js';
import type { GetDutiesByRouteUseCase } from '../../application/use-cases/GetDutiesByRouteUseCase.js';
import type { DeleteRouteUseCase } from '../../../route/application/use-cases/DeleteRouteUseCase.js';

describe('RouteDutyIntegrationResolver', () => {
  let getDutiesByRouteUseCase: Pick<GetDutiesByRouteUseCase, 'execute'>;
  let deleteRouteUseCase: Pick<DeleteRouteUseCase, 'execute'>;
  let resolver: RouteDutyIntegrationResolver;
  let route: Route;
  let unit: Unit;
  let duty: Duty;

  beforeEach(() => {
    route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    duty = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    getDutiesByRouteUseCase = { execute: vi.fn() };
    deleteRouteUseCase = { execute: vi.fn() };
    resolver = new RouteDutyIntegrationResolver(
      getDutiesByRouteUseCase as GetDutiesByRouteUseCase,
      deleteRouteUseCase as DeleteRouteUseCase,
    );
  });

  it('duties field resolver returns duties mapped to DutyType', async () => {
    vi.mocked(getDutiesByRouteUseCase.execute).mockResolvedValue([duty]);
    const result = await resolver.duties({ id: route.id.value } as never);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(duty.id.value);
  });

  it('deleteRoute succeeds when the route has no duties', async () => {
    vi.mocked(getDutiesByRouteUseCase.execute).mockResolvedValue([]);
    vi.mocked(deleteRouteUseCase.execute).mockResolvedValue(true);

    const result = await resolver.deleteRoute(route.id.value);
    expect(result).toBe(true);
    expect(deleteRouteUseCase.execute).toHaveBeenCalledWith(route.id.value);
  });

  it('deleteRoute is rejected when the route has active duties', async () => {
    vi.mocked(getDutiesByRouteUseCase.execute).mockResolvedValue([duty]);

    await expect(resolver.deleteRoute(route.id.value)).rejects.toThrow(
      RouteHasActiveDutiesError,
    );
    expect(deleteRouteUseCase.execute).not.toHaveBeenCalled();
  });
});
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/UnitDutyIntegration.resolver.spec.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnitDutyIntegrationResolver } from './UnitDutyIntegration.resolver.js';
import { Duty } from '../../domain/entities/Duty.js';
import { Route } from '../../../route/domain/entities/Route.js';
import { Unit } from '../../../unit/domain/entities/Unit.js';
import { UnitHasActiveDutiesError } from '../../../unit/domain/errors/UnitErrors.js';
import type { GetDutiesByUnitUseCase } from '../../application/use-cases/GetDutiesByUnitUseCase.js';
import type { DeleteUnitUseCase } from '../../../unit/application/use-cases/DeleteUnitUseCase.js';

describe('UnitDutyIntegrationResolver', () => {
  let getDutiesByUnitUseCase: Pick<GetDutiesByUnitUseCase, 'execute'>;
  let deleteUnitUseCase: Pick<DeleteUnitUseCase, 'execute'>;
  let resolver: UnitDutyIntegrationResolver;
  let unit: Unit;
  let duty: Duty;

  beforeEach(() => {
    const route = Route.create({ points: [] });
    unit = Unit.create({ name: 'ABC-123', driverName: 'Jane Doe' });
    duty = Duty.create({
      routeId: route.id,
      unitId: unit.id,
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    getDutiesByUnitUseCase = { execute: vi.fn() };
    deleteUnitUseCase = { execute: vi.fn() };
    resolver = new UnitDutyIntegrationResolver(
      getDutiesByUnitUseCase as GetDutiesByUnitUseCase,
      deleteUnitUseCase as DeleteUnitUseCase,
    );
  });

  it('deleteUnit succeeds when the unit has no duties', async () => {
    vi.mocked(getDutiesByUnitUseCase.execute).mockResolvedValue([]);
    vi.mocked(deleteUnitUseCase.execute).mockResolvedValue(true);

    const result = await resolver.deleteUnit(unit.id.value);
    expect(result).toBe(true);
    expect(deleteUnitUseCase.execute).toHaveBeenCalledWith(unit.id.value);
  });

  it('deleteUnit is rejected when the unit has active duties', async () => {
    vi.mocked(getDutiesByUnitUseCase.execute).mockResolvedValue([duty]);

    await expect(resolver.deleteUnit(unit.id.value)).rejects.toThrow(
      UnitHasActiveDutiesError,
    );
    expect(deleteUnitUseCase.execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test duty/infrastructure/graphql`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/modules/duty/infrastructure/graphql/Duty.object-type.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';

@ObjectType('Duty')
export class DutyType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  routeId: string;

  @Field(() => ID)
  unitId: string;

  @Field()
  startsAt: Date;

  @Field()
  endsAt: Date;

  // Populated by DutyResolver's @ResolveField methods, not set directly by the mapper.
  route?: RouteType;
  unit?: UnitType;
}
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/CreateDuty.input.ts
import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateDutyInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Route is required' })
  routeId: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'Unit is required' })
  unitId: string;

  @Field()
  @IsDate()
  startsAt: Date;

  @Field()
  @IsDate()
  endsAt: Date;
}
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/UpdateDuty.input.ts
import { Field, ID, InputType } from '@nestjs/graphql';
import { IsDate, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateDutyInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  routeId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  unitId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  startsAt?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  endsAt?: Date;
}
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/Duty.mapper.ts
import type { Duty } from '../../domain/entities/Duty.js';
import type { DutyType } from './Duty.object-type.js';

export function toDutyType(duty: Duty): DutyType {
  return {
    id: duty.id.value,
    routeId: duty.routeId.value,
    unitId: duty.unitId.value,
    startsAt: duty.startsAt,
    endsAt: duty.endsAt,
  };
}
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/Duty.resolver.ts
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase.js';
import { UpdateDutyUseCase } from '../../application/use-cases/UpdateDutyUseCase.js';
import { DeleteDutyUseCase } from '../../application/use-cases/DeleteDutyUseCase.js';
import { GetDutiesUseCase } from '../../application/use-cases/GetDutiesUseCase.js';
import { GetDutyByIdUseCase } from '../../application/use-cases/GetDutyByIdUseCase.js';
import { CreateDutyInput } from './CreateDuty.input.js';
import { UpdateDutyInput } from './UpdateDuty.input.js';
import { DutyType } from './Duty.object-type.js';
import { toDutyType } from './Duty.mapper.js';
import { RouteRepository } from '../../../route/application/ports/RouteRepository.js';
import { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import { RouteNotFoundError } from '../../../route/domain/errors/RouteErrors.js';
import { toRouteType } from '../../../route/infrastructure/graphql/Route.mapper.js';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { UnitRepository } from '../../../unit/application/ports/UnitRepository.js';
import { UnitId } from '../../../unit/domain/value-objects/UnitId.js';
import { UnitNotFoundError } from '../../../unit/domain/errors/UnitErrors.js';
import { toUnitType } from '../../../unit/infrastructure/graphql/Unit.mapper.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';

@Resolver(() => DutyType)
export class DutyResolver {
  constructor(
    private readonly createDutyUseCase: CreateDutyUseCase,
    private readonly updateDutyUseCase: UpdateDutyUseCase,
    private readonly deleteDutyUseCase: DeleteDutyUseCase,
    private readonly getDutiesUseCase: GetDutiesUseCase,
    private readonly getDutyByIdUseCase: GetDutyByIdUseCase,
    private readonly routeRepository: RouteRepository,
    private readonly unitRepository: UnitRepository,
  ) {}

  @Query(() => [DutyType])
  async duties(): Promise<DutyType[]> {
    const duties = await this.getDutiesUseCase.execute();
    return duties.map(toDutyType);
  }

  @Query(() => DutyType, { nullable: true })
  async duty(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<DutyType | null> {
    const duty = await this.getDutyByIdUseCase.execute(id);
    return duty ? toDutyType(duty) : null;
  }

  @Mutation(() => DutyType)
  async createDuty(@Args('input') input: CreateDutyInput): Promise<DutyType> {
    const duty = await this.createDutyUseCase.execute(input);
    return toDutyType(duty);
  }

  @Mutation(() => DutyType)
  async updateDuty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateDutyInput,
  ): Promise<DutyType> {
    const duty = await this.updateDutyUseCase.execute(id, input);
    return toDutyType(duty);
  }

  @Mutation(() => Boolean)
  async deleteDuty(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.deleteDutyUseCase.execute(id);
  }

  @ResolveField(() => RouteType)
  async route(@Parent() duty: DutyType): Promise<RouteType> {
    const route = await this.routeRepository.findById(
      RouteId.restore(duty.routeId),
    );
    if (!route) throw new RouteNotFoundError();
    return toRouteType(route);
  }

  @ResolveField(() => UnitType)
  async unit(@Parent() duty: DutyType): Promise<UnitType> {
    const unit = await this.unitRepository.findById(
      UnitId.restore(duty.unitId),
    );
    if (!unit) throw new UnitNotFoundError();
    return toUnitType(unit);
  }
}
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/RouteDutyIntegration.resolver.ts
import {
  Args,
  ID,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { GetDutiesByRouteUseCase } from '../../application/use-cases/GetDutiesByRouteUseCase.js';
import { toDutyType } from './Duty.mapper.js';
import { DutyType } from './Duty.object-type.js';
import { RouteType } from '../../../route/infrastructure/graphql/Route.object-type.js';
import { DeleteRouteUseCase } from '../../../route/application/use-cases/DeleteRouteUseCase.js';
import { RouteHasActiveDutiesError } from '../../../route/domain/errors/RouteErrors.js';

/**
 * Lives in the `duty` module, not `route`, on purpose: deciding whether a route can be deleted
 * requires knowing about duties, and `route` never imports `duty` (see the plan header's
 * Architecture note and agent_docs/backend/architecture.md). RouteResolver (in the `route`
 * module) intentionally has no `deleteRoute` mutation — this is the only place it's implemented.
 */
@Resolver(() => RouteType)
export class RouteDutyIntegrationResolver {
  constructor(
    private readonly getDutiesByRouteUseCase: GetDutiesByRouteUseCase,
    private readonly deleteRouteUseCase: DeleteRouteUseCase,
  ) {}

  @ResolveField(() => [DutyType])
  async duties(@Parent() route: RouteType): Promise<DutyType[]> {
    const duties = await this.getDutiesByRouteUseCase.execute(route.id);
    return duties.map(toDutyType);
  }

  @Mutation(() => Boolean)
  async deleteRoute(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const duties = await this.getDutiesByRouteUseCase.execute(id);
    if (duties.length > 0) throw new RouteHasActiveDutiesError();
    return this.deleteRouteUseCase.execute(id);
  }
}
```

```typescript
// backend/src/modules/duty/infrastructure/graphql/UnitDutyIntegration.resolver.ts
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { GetDutiesByUnitUseCase } from '../../application/use-cases/GetDutiesByUnitUseCase.js';
import { UnitType } from '../../../unit/infrastructure/graphql/Unit.object-type.js';
import { DeleteUnitUseCase } from '../../../unit/application/use-cases/DeleteUnitUseCase.js';
import { UnitHasActiveDutiesError } from '../../../unit/domain/errors/UnitErrors.js';

/** Same reasoning as RouteDutyIntegrationResolver — see its doc comment. */
@Resolver(() => UnitType)
export class UnitDutyIntegrationResolver {
  constructor(
    private readonly getDutiesByUnitUseCase: GetDutiesByUnitUseCase,
    private readonly deleteUnitUseCase: DeleteUnitUseCase,
  ) {}

  @Mutation(() => Boolean)
  async deleteUnit(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const duties = await this.getDutiesByUnitUseCase.execute(id);
    if (duties.length > 0) throw new UnitHasActiveDutiesError();
    return this.deleteUnitUseCase.execute(id);
  }
}
```

- [ ] **Step 4: Write `duty.module.ts` and register it**

```typescript
// backend/src/modules/duty/duty.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RouteModule } from '../route/route.module.js';
import { UnitModule } from '../unit/unit.module.js';
import {
  DutyDocument,
  DutySchema,
} from './infrastructure/persistence/duty.schema.js';
import { DutyRepositoryAdapter } from './infrastructure/persistence/DutyRepositoryAdapter.js';
import { DutyRepository } from './application/ports/DutyRepository.js';
import { CreateDutyUseCase } from './application/use-cases/CreateDutyUseCase.js';
import { UpdateDutyUseCase } from './application/use-cases/UpdateDutyUseCase.js';
import { DeleteDutyUseCase } from './application/use-cases/DeleteDutyUseCase.js';
import { GetDutyByIdUseCase } from './application/use-cases/GetDutyByIdUseCase.js';
import { GetDutiesUseCase } from './application/use-cases/GetDutiesUseCase.js';
import { GetDutiesByRouteUseCase } from './application/use-cases/GetDutiesByRouteUseCase.js';
import { GetDutiesByUnitUseCase } from './application/use-cases/GetDutiesByUnitUseCase.js';
import { DutyResolver } from './infrastructure/graphql/Duty.resolver.js';
import { RouteDutyIntegrationResolver } from './infrastructure/graphql/RouteDutyIntegration.resolver.js';
import { UnitDutyIntegrationResolver } from './infrastructure/graphql/UnitDutyIntegration.resolver.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DutyDocument.name, schema: DutySchema },
    ]),
    RouteModule,
    UnitModule,
  ],
  providers: [
    { provide: DutyRepository, useClass: DutyRepositoryAdapter },
    CreateDutyUseCase,
    UpdateDutyUseCase,
    DeleteDutyUseCase,
    GetDutyByIdUseCase,
    GetDutiesUseCase,
    GetDutiesByRouteUseCase,
    GetDutiesByUnitUseCase,
    DutyResolver,
    RouteDutyIntegrationResolver,
    UnitDutyIntegrationResolver,
  ],
})
export class DutyModule {}
```

```typescript
// backend/src/app.module.ts
import { DutyModule } from './modules/duty/duty.module.js';
```

Add `DutyModule` to the `imports` array.

- [ ] **Step 5: Run tests, then build**

Run: `pnpm test duty/infrastructure/graphql` — expect PASS (8 tests).
Run: `pnpm build` — expect success. If it fails with "circular import", double check that `route`
and `unit` modules truly have no import of `duty` anywhere (grep `from '../../duty` in
`backend/src/modules/route` and `backend/src/modules/unit` — there should be zero matches).

- [ ] **Step 6: Manual smoke check**

Start the backend (`pnpm start:dev`) and in Apollo Sandbox (`http://localhost:3001/graphql`):

```graphql
mutation {
  createRoute(
    input: { name: "Centro-Norte", points: [{ lat: 10.5, lng: -66.9 }] }
  ) {
    id
  }
}
mutation {
  createUnit(input: { name: "ABC-123", driverName: "Jane Doe" }) {
    id
  }
}
```

Take the two returned ids and:

```graphql
mutation ($routeId: ID!, $unitId: ID!) {
  createDuty(
    input: {
      routeId: $routeId
      unitId: $unitId
      startsAt: "2026-01-01T08:00:00Z"
      endsAt: "2026-01-01T16:00:00Z"
    }
  ) {
    id
    route {
      name
    }
    unit {
      name
      driverName
    }
  }
}
```

Then re-run the same mutation with an overlapping window and confirm the response's `errors[0]`
has `extensions.code: "dutyOverlap"`. Then:

```graphql
mutation ($routeId: ID!) {
  deleteRoute(id: $routeId)
}
```

Confirm it fails with `extensions.code: "routeHasActiveDuties"`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/duty/infrastructure/graphql backend/src/modules/duty/duty.module.ts backend/src/app.module.ts
git commit -m "feat(backend): add Duty GraphQL surface and cross-module deletion guards"
```

---

### Task 14: Full end-to-end test

**Files:**

- Create: `backend/test/transport-planning.e2e-spec.ts`

**Interfaces:**

- Consumes: the entire app (`AppModule`).

- [ ] **Step 1: Write the E2E test**

```typescript
// backend/test/transport-planning.e2e-spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import mongoose from 'mongoose';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import { AppModule } from '../src/app.module.js';

describe('Transport planning (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.MONGODB_URI =
      process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/prueba_test';
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await app.close();
  });

  beforeEach(async () => {
    await mongoose.connection.collection('routes').deleteMany({});
    await mongoose.connection.collection('units').deleteMany({});
    await mongoose.connection.collection('duties').deleteMany({});
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
});
```

- [ ] **Step 2: Run it**

Run (from `backend/`): `pnpm test:e2e`
Expected: PASS (2 tests). Both tests require `mongod` running locally.

- [ ] **Step 3: Run the full suite and lint**

Run: `pnpm test && pnpm test:e2e && pnpm lint && pnpm build`
Expected: everything green.

- [ ] **Step 4: Commit**

```bash
git add backend/test/transport-planning.e2e-spec.ts
git commit -m "test(backend): add full-stack e2e coverage including the concurrent-duty race"
```

---

### Task 15: Document the one-directional cross-module pattern

**Files:**

- Modify: `agent_docs/backend/architecture.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Add a short section**

Read `agent_docs/backend/architecture.md` first, then add a new subsection right after "Cross-module access" (near the end of the file):

```markdown
### Avoiding circular cross-module dependencies

When two modules each need something from the other (e.g. `duty` needs `route`/`unit` to validate
references on create, but `route`/`unit` need `duty` to guard against deleting something still in
use), don't reach for `forwardRef()`. Instead, identify which module can be the sole importer —
usually the one that represents the "join"/dependent concept (here, `duty`, since a `Duty` only
exists in relation to a `Route` and a `Unit`, never the reverse) — and move the
otherwise-circular behavior into _that_ module:

- `route`/`unit` keep a simple, duty-unaware delete use-case (`DeleteRouteUseCase`,
  `DeleteUnitUseCase`), exported so `duty` can call it.
- The GraphQL mutation that actually needs duty-awareness (`deleteRoute`, `deleteUnit`) is
  resolved by a small `@Resolver()` class that lives _inside_ the `duty` module, injecting the
  exported delete use-case plus `duty`'s own repository to run the guard check.

This keeps the module import graph one-directional (`duty → route`, `duty → unit`, never the
reverse), avoids `forwardRef()`'s initialization-order footguns, and only costs one thing: a
GraphQL type's full mutation surface can be split across two modules' files. Name the resolver
class to make that obvious (`RouteDutyIntegrationResolver`, not `RouteResolver2`), and say why in
a doc comment. See `backend/src/modules/duty/infrastructure/graphql/RouteDutyIntegration.resolver.ts`
for a worked example.
```

- [ ] **Step 2: Format and commit**

```bash
cd /Users/moisesperez/prueba
pnpm format
git add agent_docs/backend/architecture.md
git commit -m "docs(backend): document the one-directional cross-module guard pattern"
```
