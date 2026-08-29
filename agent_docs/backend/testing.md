---
description: Backend testing strategy — unit/integration/E2E pyramid, mocked ports, in-memory fakes, commands
globs: "backend/src/**/*.spec.ts, backend/test/**/*.e2e-spec.ts"
alwaysApply: false
---

# Testing Guide — backend

## Quick reference

```bash
cd backend
pnpm test          # run all unit/integration tests (vitest run)
pnpm test:watch    # watch mode
pnpm test:cov      # coverage
pnpm test:e2e      # E2E tests (vitest run --config ./vitest.config.e2e.ts)
```

| Layer | What to test | Tool |
|---|---|---|
| Domain (entities, value objects, policies) | Business rules, validation, invariants | Vitest — pure unit |
| Application (use-cases) | Orchestration logic, port interactions | Vitest — unit with mocked ports |
| Infrastructure (repository adapters) | Mongoose queries, document↔domain mapping | Vitest — integration against a real/test Mongo |
| Presentation (resolvers) | GraphQL wiring, argument→use-case→response mapping | NestJS `Test.createTestingModule` |

**Done = verified:** `pnpm test` passes, no flaky async tests (stabilize with `vi.useFakeTimers()`
or proper `await`).

Test files live **next to the file they test**, using the `.spec.ts` suffix:

```
src/modules/duty/
├── domain/entities/Duty.spec.ts
├── application/use-cases/CreateDutyUseCase.spec.ts
└── infrastructure/persistence/DutyRepositoryAdapter.spec.ts
```

E2E tests live in `backend/test/*.e2e-spec.ts`.

---

## The test pyramid

The test pyramid applies directly to the Hexagonal Architecture: most tests are unit tests against
pure domain logic, fewer are integration tests that verify NestJS wiring, and fewest are E2E tests
that exercise the full GraphQL surface.

- **Unit tests** ask: "is the business rule correct?"
- **Integration tests** ask: "does the wiring work?"
- **E2E tests** ask: "does the GraphQL API respond correctly end-to-end?"

Because domain and application logic have zero NestJS imports, unit tests require no framework
overhead — plain `describe`/`it` blocks with `vi.fn()` mocks running in milliseconds. Testing
business rules through a GraphQL request when a unit test would suffice is the most common waste
of testing effort — it inflates runtime by orders of magnitude and makes tests sensitive to
irrelevant infrastructure concerns.

---

## 1. Unit tests — Domain layer

Entities, value objects, and policies are pure TypeScript. No mocks needed — instantiate directly.

```typescript
// ✅ src/modules/duty/domain/entities/Duty.spec.ts
import { describe, expect, it } from 'vitest';
import { Duty } from './Duty';
import { InvalidDutyWindowError } from '../errors/DutyErrors';

describe('Duty', () => {
  it('creates a valid duty', () => {
    const duty = Duty.create({
      title: 'Night shift',
      assigneeId: 'employee-1',
      startsAt: new Date('2026-01-01T20:00:00Z'),
      endsAt: new Date('2026-01-02T04:00:00Z'),
    });
    expect(duty.title).toBe('Night shift');
  });

  it('throws when endsAt is before startsAt', () => {
    expect(() =>
      Duty.create({
        title: 'Invalid',
        assigneeId: 'employee-1',
        startsAt: new Date('2026-01-02T00:00:00Z'),
        endsAt: new Date('2026-01-01T00:00:00Z'),
      }),
    ).toThrow(InvalidDutyWindowError);
  });
});
```

```typescript
// ✅ src/modules/duty/domain/policies/DutyOverlapPolicy.spec.ts
import { describe, expect, it } from 'vitest';
import { DutyOverlapPolicy } from './DutyOverlapPolicy';
import { DutyOverlapError } from '../errors/DutyErrors';
import { buildDuty } from '../../../../test/support/dutyFactory';

describe('DutyOverlapPolicy', () => {
  it('throws when the candidate overlaps an existing duty', () => {
    const existing = buildDuty({ startsAt: '2026-01-01T08:00:00Z', endsAt: '2026-01-01T16:00:00Z' });
    const candidate = buildDuty({ startsAt: '2026-01-01T12:00:00Z', endsAt: '2026-01-01T20:00:00Z' });

    expect(() => DutyOverlapPolicy.assertNoOverlap(candidate, [existing])).toThrow(DutyOverlapError);
  });

  it('passes when there is no overlap', () => {
    const existing = buildDuty({ startsAt: '2026-01-01T08:00:00Z', endsAt: '2026-01-01T16:00:00Z' });
    const candidate = buildDuty({ startsAt: '2026-01-01T16:00:00Z', endsAt: '2026-01-02T00:00:00Z' });

    expect(() => DutyOverlapPolicy.assertNoOverlap(candidate, [existing])).not.toThrow();
  });
});
```

---

## 2. Unit tests — Application layer (use-cases)

Use-cases are tested with plain `new` — no `Test.createTestingModule()`. Inject a mock repository
using `vi.fn()`.

```typescript
// ✅ src/modules/duty/application/use-cases/CreateDutyUseCase.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateDutyUseCase } from './CreateDutyUseCase';
import type { DutyRepository } from '../ports/DutyRepository';

describe('CreateDutyUseCase', () => {
  let useCase: CreateDutyUseCase;
  let dutyRepository: DutyRepository;

  beforeEach(() => {
    dutyRepository = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      findByAssignee: vi.fn().mockResolvedValue([]),
    };
    useCase = new CreateDutyUseCase(dutyRepository);
  });

  it('creates and returns the new duty when there is no overlap', async () => {
    const input = {
      title: 'Night shift',
      assigneeId: 'employee-1',
      startsAt: new Date('2026-01-01T20:00:00Z'),
      endsAt: new Date('2026-01-02T04:00:00Z'),
    };
    vi.mocked(dutyRepository.create).mockImplementation(async (duty) => duty);

    const result = await useCase.execute(input);

    expect(dutyRepository.create).toHaveBeenCalledOnce();
    expect(result.title).toBe('Night shift');
  });
});
```

**Key rules:**
- Never instantiate a real repository adapter in use-case tests.
- Never connect to a database in use-case tests.
- Create fresh mocks in `beforeEach` — never share mutable state between tests.
- One behavior per test; name with `it('<does something>')`.

---

## 3. Test doubles — In-memory fakes

For use-cases with multiple interactions, prefer an **in-memory fake** over `vi.fn()` mocks. A
fake is a real implementation of the abstract repository that stores data in memory.

```typescript
// ✅ src/modules/duty/infrastructure/memory/DutyRepositoryFake.ts
import { DutyRepository } from '../../application/ports/DutyRepository';
import type { Duty } from '../../domain/entities/Duty';
import type { DutyId } from '../../domain/value-objects/DutyId';

export class DutyRepositoryFake extends DutyRepository {
  private readonly store = new Map<string, Duty>();

  async create(duty: Duty): Promise<Duty> {
    this.store.set(duty.id.value, duty);
    return duty;
  }

  async findById(id: DutyId): Promise<Duty | null> {
    return this.store.get(id.value) ?? null;
  }

  async findByAssignee(assigneeId: string): Promise<Duty[]> {
    return Array.from(this.store.values()).filter((d) => d.assigneeId === assigneeId);
  }

  async findAll(): Promise<Duty[]> {
    return Array.from(this.store.values());
  }

  async update(id: DutyId, duty: Duty): Promise<Duty | null> {
    if (!this.store.has(id.value)) return null;
    this.store.set(id.value, duty);
    return duty;
  }

  async delete(id: DutyId): Promise<boolean> {
    return this.store.delete(id.value);
  }
}
```

---

## 4. Integration tests — NestJS wiring

Use `Test.createTestingModule()` only to verify the DI container resolves correctly.

```typescript
// ✅ verifying module wiring
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DutyModule } from '../../duty.module';
import { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase';
import { DutyRepository } from '../../application/ports/DutyRepository';
import { DutyRepositoryFake } from '../memory/DutyRepositoryFake';

describe('DutyModule (wiring)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [DutyModule] })
      .overrideProvider(DutyRepository)
      .useValue(new DutyRepositoryFake())
      .compile();
  });

  afterAll(async () => {
    await module.close();
  });

  it('resolves CreateDutyUseCase from the container', () => {
    expect(module.get(CreateDutyUseCase)).toBeDefined();
  });
});
```

For a resolver test, mock the use-cases it depends on directly (there's no bus to mock — resolvers
inject use-cases straight):

```typescript
// ✅ resolver test: mock the use-case
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DutyResolver } from './Duty.resolver';
import { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase';
import { GetDutiesUseCase } from '../../application/use-cases/GetDutiesUseCase';
import { Duty } from '../../domain/entities/Duty';

describe('DutyResolver', () => {
  let resolver: DutyResolver;
  const createDutyUseCase = { execute: vi.fn() };
  const getDutiesUseCase = { execute: vi.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DutyResolver,
        { provide: CreateDutyUseCase, useValue: createDutyUseCase },
        { provide: GetDutiesUseCase, useValue: getDutiesUseCase },
      ],
    }).compile();

    resolver = module.get(DutyResolver);
    vi.clearAllMocks();
  });

  it('maps the created duty to DutyType', async () => {
    const mockDuty = Duty.restore({ /* ... */ } as never);
    createDutyUseCase.execute.mockResolvedValue(mockDuty);

    const result = await resolver.createDuty({ /* valid input */ } as never);

    expect(createDutyUseCase.execute).toHaveBeenCalledOnce();
    expect(result.id).toBe(mockDuty.id.value);
  });
});
```

---

## 5. Integration tests — Repository adapters (Mongo)

Test the Mongoose adapter against a real (or test-instance) MongoDB. Validate that documents are
correctly inserted, queried, and mapped back to domain entities.

```typescript
// ✅ src/modules/duty/infrastructure/persistence/DutyRepositoryAdapter.spec.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { DutyRepositoryAdapter } from './DutyRepositoryAdapter';
import { testDb } from '../../../../test/support/testDb';
import { Duty } from '../../domain/entities/Duty';

describe('DutyRepositoryAdapter', () => {
  let repo: DutyRepositoryAdapter;

  beforeEach(async () => {
    await testDb.reset();
    repo = new DutyRepositoryAdapter(testDb.model('DutyDocument'));
  });

  it('persists and retrieves a duty', async () => {
    const duty = Duty.create({
      title: 'Test duty',
      assigneeId: 'employee-1',
      startsAt: new Date('2026-01-01T08:00:00Z'),
      endsAt: new Date('2026-01-01T16:00:00Z'),
    });

    const saved = await repo.create(duty);
    const found = await repo.findById(saved.id);

    expect(found?.title).toBe('Test duty');
  });
});
```

---

## 6. E2E tests — Full GraphQL stack

E2E tests spin up the full application and send real GraphQL requests via `supertest`.

```typescript
// ✅ backend/test/duties.e2e-spec.ts
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { AppModule } from '../src/app.module';

describe('Duties (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a duty via GraphQL', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Accept', 'application/json')
      .send({
        query: `mutation($input: CreateDutyInput!) { createDuty(input: $input) { id title } }`,
        variables: {
          input: {
            title: 'Night shift',
            assigneeId: 'employee-1',
            startsAt: '2026-01-01T20:00:00.000Z',
            endsAt: '2026-01-02T04:00:00.000Z',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.createDuty.title).toBe('Night shift');
  });

  it('returns a dutyOverlap GraphQL error on conflict', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: `mutation($input: CreateDutyInput!) { createDuty(input: $input) { id } }`, variables: { input: { /* overlapping window */ } } });

    expect(response.body.errors?.[0]?.extensions?.code).toBe('dutyOverlap');
  });
});
```

Note GraphQL E2E responses are always HTTP `200` — errors live in the `errors` array of the JSON
body, not in the status code. Assert on `response.body.errors`, not `response.status`, for
business-rule failures.

---

## What to mock vs what to test for real

| Always mock / fake | Always test for real |
|---|---|
| Repository adapters in use-case tests | Domain entities and value objects |
| `Model` (Mongoose) in resolver/use-case tests | Domain policies |
| Time (`vi.useFakeTimers`) and randomness | GraphQL input validation (`class-validator`) |
| | Repository adapters (integration test with a real Mongo) |
| | Full GraphQL flow in E2E tests |

---

## Anti-patterns

### ❌ Testing business logic through GraphQL

```typescript
// ❌ Bad — E2E test for a pure domain rule
it('rejects an invalid duty window', async () => {
  const response = await request(app.getHttpServer())
    .post('/graphql')
    .send({ query: `...`, variables: { input: { endsAt: 'before startsAt' } } });
  // 100x slower than a unit test, and sensitive to unrelated GraphQL/HTTP changes
});
```

Test `Duty.create({ ... })` directly in `Duty.spec.ts` instead.

### ❌ Using `Test.createTestingModule` for a pure unit test

```typescript
// ❌ Bad — framework overhead where none is needed
const module = await Test.createTestingModule({
  providers: [CreateDutyUseCase, { provide: DutyRepository, useValue: mockRepo }],
}).compile();
```

Just use `new CreateDutyUseCase(mockRepo)`.

### ❌ Shared mutable state between tests

```typescript
// ❌ Bad — fake shared across tests, test order matters
const repo = new DutyRepositoryFake();
it('test one', async () => { await repo.create(/* ... */); });
it('test two', async () => {
  const all = await repo.findAll();
  expect(all).toHaveLength(0); // fails — test one already inserted
});
```

Always create a fresh fake in `beforeEach`.

### ❌ Mocking domain classes

```typescript
// ❌ Bad — mocking an entity
vi.mock('../../domain/entities/Duty');
```

Domain classes are pure TypeScript — test them directly, never mock them.
