---
description: Backend Hexagonal Architecture — NestJS + GraphQL + Mongoose, ports & adapters, dependency direction
globs: 'backend/src/**/*.ts'
alwaysApply: false
---

# Architecture

We use **Hexagonal Architecture** (Ports & Adapters). Business logic is isolated from
infrastructure — MongoDB, GraphQL, and any third-party API. The domain must be expressible in
plain TypeScript with no NestJS imports, no Mongoose imports, and no GraphQL decorators. This
makes every business rule independently testable, independently replaceable, and independently
understandable.

NestJS is the composition root: its module system wires ports to adapters via DI. The framework
does not enforce these boundaries for you — that discipline is the developer's job. This guide is
the enforcement mechanism.

---

## The Four Zones

```
┌──────────────────────────────────────────────────────────────┐
│                  Presentation (GraphQL)                       │
│   @Resolver() — parses the GraphQL request, calls the         │
│   use-case directly, maps the domain entity to an @ObjectType.│
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Application                          │  │
│  │   Use-cases — orchestrate domain services. No GraphQL, │  │
│  │   no Mongoose imports.                                  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │                   Domain                         │  │  │
│  │  │   Pure business logic. Entities, value objects,  │  │  │
│  │  │   policies, domain errors. Zero external         │  │  │
│  │  │   dependencies.                                  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │                    Ports                         │  │  │
│  │  │   Abstract classes. E.g. DutyRepository — the     │  │  │
│  │  │   contract between application and infra.         │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  Infrastructure                        │  │
│  │   Mongoose schemas + repositories. Implements ports,   │  │
│  │   knows the domain; the domain does not know about it. │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## The Dependency Rule

**Dependencies always point inward.** Presentation depends on Application. Application depends on
Domain and Ports. Infrastructure implements Ports.

```
Presentation → Application → Domain
Infrastructure → Ports (implements) ← Application (uses)
```

Never:

```
Domain → Infrastructure       ❌ (domain importing Mongoose)
Domain → NestJS decorators    ❌ (domain importing @nestjs/* or @Field())
Application → Resolver        ❌ (use-case importing GraphQL constructs)
```

---

## NestJS / GraphQL Component Mapping

| NestJS / GraphQL Construct | Hexagonal Role                      | Zone           |
| -------------------------- | ----------------------------------- | -------------- |
| Plain TypeScript class     | Entity / Value Object / Policy      | Domain         |
| `@Injectable()` use-case   | Application Use-Case                | Application    |
| Abstract class             | Output Port                         | Ports          |
| `@Resolver()`              | Input Adapter                       | Presentation   |
| `@ObjectType()` class      | Output DTO (GraphQL response shape) | Presentation   |
| `@InputType()` class       | Input DTO (GraphQL argument shape)  | Presentation   |
| `@Injectable()` repository | Output Adapter                      | Infrastructure |
| `@Schema()` (Mongoose)     | Persistence model                   | Infrastructure |
| `@Module()`                | Composition Root                    | All            |

---

## Directory Mapping

```
backend/src/modules/<feature>/
├── domain/
│   ├── entities/
│   │   └── <Feature>.ts                    # Entity — encapsulates business invariants
│   ├── value-objects/
│   │   └── <Feature>Id.ts                  # Typed ID to prevent primitive obsession
│   ├── policies/                           # Business rule validators
│   │   └── <Feature>Policy.ts
│   └── errors/
│       └── <Feature>Errors.ts              # DomainError subclasses
├── application/
│   ├── ports/
│   │   └── <Feature>Repository.ts          # Abstract class — output port
│   └── use-cases/
│       ├── Create<Feature>UseCase.ts
│       ├── Update<Feature>UseCase.ts
│       ├── Delete<Feature>UseCase.ts
│       ├── Get<Feature>ByIdUseCase.ts
│       └── Get<Feature>sUseCase.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── <feature>.schema.ts             # Mongoose schema + document type
│   │   └── <Feature>RepositoryAdapter.ts   # Output adapter (Mongoose)
│   └── graphql/
│       ├── <Feature>.resolver.ts           # Input adapter (GraphQL)
│       ├── <Feature>.object-type.ts        # @ObjectType() — response shape
│       └── <Feature>.input.ts              # @InputType() classes — create/update args
└── <feature>.module.ts                     # Composition root
```

There is no CQRS bus in this project (no `@nestjs/cqrs`, no `CommandBus`/`QueryBus`) — the MVP is
a handful of modules and a resolver injecting a use-case directly is enough. If a future need
arises for one module to call into another module's logic across a real boundary, prefer
importing the other module and injecting its exported abstract repository (see "Cross-module
access" below) before reaching for a message bus.

---

## Domain Zone

Zero NestJS imports. Zero Mongoose imports. Zero GraphQL decorators.

### Entity

```typescript
// ✅ src/modules/duty/domain/entities/Duty.ts
export interface DutyProps {
  id: DutyId;
  title: string;
  assigneeId: string;
  startsAt: Date;
  endsAt: Date;
  status: TDutyStatus;
}

export class Duty {
  private constructor(private readonly props: DutyProps) {}

  static create(props: Omit<DutyProps, 'id' | 'status'>): Duty {
    if (props.endsAt <= props.startsAt) {
      throw new InvalidDutyWindowError();
    }
    return new Duty({ ...props, id: DutyId.generate(), status: 'pending' });
  }

  // Restoring from the database — trusts stored data, skips creation validation
  static restore(props: DutyProps): Duty {
    return new Duty(props);
  }

  get id(): DutyId {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get startsAt(): Date {
    return this.props.startsAt;
  }
  get endsAt(): Date {
    return this.props.endsAt;
  }

  overlaps(other: Duty): boolean {
    return this.startsAt < other.endsAt && other.startsAt < this.endsAt;
  }
}
```

### Value Object

```typescript
// ✅ src/modules/duty/domain/value-objects/DutyId.ts
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

### Domain Policies

Standalone validator classes for rules too complex for a single entity — e.g. checking a new duty
against every existing assignment for overlap.

```typescript
// ✅ src/modules/duty/domain/policies/DutyOverlapPolicy.ts
export class DutyOverlapPolicy {
  static assertNoOverlap(candidate: Duty, existing: Duty[]): void {
    const conflict = existing.find((duty) => duty.overlaps(candidate));
    if (conflict) throw new DutyOverlapError(conflict.id.value);
  }
}
```

Use a policy when the rule spans multiple entities, needs its own test suite, or is reused across
more than one use-case.

### Domain Errors

```typescript
// ✅ src/modules/duty/domain/errors/DutyErrors.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class DutyOverlapError extends DomainError {
  readonly code = 'dutyOverlap';
  constructor(conflictingDutyId: string) {
    super(`Duty overlaps with existing duty ${conflictingDutyId}`);
  }
}

export class DutyNotFoundError extends DomainError {
  readonly code = 'dutyNotFound';
  constructor() {
    super('Duty not found');
  }
}
```

See `agent_docs/backend/error-handling.md` for how these surface through GraphQL.

---

## Ports Zone

Abstract classes define the contract for persistence. The application layer depends on these,
never on the concrete Mongoose adapter — this is what makes use-cases testable with an in-memory
fake.

```typescript
// ✅ src/modules/duty/application/ports/DutyRepository.ts
export abstract class DutyRepository {
  abstract create(duty: Duty): Promise<Duty>;
  abstract update(id: DutyId, duty: Duty): Promise<Duty | null>;
  abstract delete(id: DutyId): Promise<boolean>;
  abstract findById(id: DutyId): Promise<Duty | null>;
  abstract findAll(): Promise<Duty[]>;
  abstract findByAssignee(assigneeId: string): Promise<Duty[]>;
}
```

---

## Application Zone

Use-cases orchestrate domain + ports. They do not contain business rules — they sequence
operations and call the domain to validate.

```typescript
// ✅ src/modules/duty/application/use-cases/CreateDutyUseCase.ts
import { Injectable } from '@nestjs/common';
import { Duty } from '../../domain/entities/Duty';
import { DutyOverlapPolicy } from '../../domain/policies/DutyOverlapPolicy';
import { DutyRepository } from '../ports/DutyRepository';

export interface CreateDutyInput {
  title: string;
  assigneeId: string;
  startsAt: Date;
  endsAt: Date;
}

@Injectable()
export class CreateDutyUseCase {
  constructor(private readonly dutyRepository: DutyRepository) {}

  async execute(input: CreateDutyInput): Promise<Duty> {
    const candidate = Duty.create(input);
    const existing = await this.dutyRepository.findByAssignee(input.assigneeId);
    DutyOverlapPolicy.assertNoOverlap(candidate, existing);
    return this.dutyRepository.create(candidate);
  }
}
```

---

## Infrastructure Zone

### Persistence (Mongoose)

The Mongoose schema is an infrastructure concern — it never leaks into the domain. The repository
adapter maps between the Mongoose document and the domain entity in both directions.

```typescript
// ✅ src/modules/duty/infrastructure/persistence/duty.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'duties', timestamps: true })
export class DutyDocument {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  assigneeId: string;

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;

  @Prop({ required: true, default: 'pending' })
  status: string;
}

export type DutyDocumentType = HydratedDocument<DutyDocument>;
export const DutySchema = SchemaFactory.createForClass(DutyDocument);
```

```typescript
// ✅ src/modules/duty/infrastructure/persistence/DutyRepositoryAdapter.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Duty } from '../../domain/entities/Duty';
import { DutyId } from '../../domain/value-objects/DutyId';
import { DutyRepository } from '../../application/ports/DutyRepository';
import { DutyDocument, DutyDocumentType } from './duty.schema';

@Injectable()
export class DutyRepositoryAdapter implements DutyRepository {
  constructor(
    @InjectModel(DutyDocument.name)
    private readonly model: Model<DutyDocumentType>,
  ) {}

  async create(duty: Duty): Promise<Duty> {
    const created = await this.model.create(this.toDocument(duty));
    return this.toDomain(created);
  }

  async findById(id: DutyId): Promise<Duty | null> {
    const doc = await this.model.findById(id.value).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findByAssignee(assigneeId: string): Promise<Duty[]> {
    const docs = await this.model.find({ assigneeId }).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findAll(): Promise<Duty[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async update(id: DutyId, duty: Duty): Promise<Duty | null> {
    const doc = await this.model
      .findByIdAndUpdate(id.value, this.toDocument(duty), { new: true })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(id: DutyId): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id.value).exec();
    return result !== null;
  }

  private toDomain(doc: DutyDocumentType): Duty {
    return Duty.restore({
      id: DutyId.restore(doc._id.toString()),
      title: doc.title,
      assigneeId: doc.assigneeId,
      startsAt: doc.startsAt,
      endsAt: doc.endsAt,
      status: doc.status as TDutyStatus,
    });
  }

  private toDocument(duty: Duty): Partial<DutyDocument> {
    return {
      title: duty.title,
      assigneeId: duty.assigneeId,
      startsAt: duty.startsAt,
      endsAt: duty.endsAt,
    };
  }
}
```

Hard deletes are fine for this MVP (no soft-delete / `isActive` convention) unless a spec
explicitly asks for recoverable records — don't add that ceremony speculatively.

### The atomic overlap guard (`Unit.busyWindows`)

The invariant "a unit never has two overlapping duties, even under concurrent requests" is
enforced entirely inside `UnitRepositoryAdapter` — not in the domain or application layer — via a
single atomic MongoDB `findOneAndUpdate`, not a transaction or a lock:

```typescript
this.model.findOneAndUpdate(
  {
    _id: unitId.value,
    busyWindows: {
      $not: {
        $elemMatch: { startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } },
      },
    },
  },
  { $push: { busyWindows: { dutyId, startsAt, endsAt } } },
);
```

`busyWindows` is a Mongoose-only field on the `Unit` document — it is never part of the domain
`Unit` entity or the GraphQL `Unit` type. A single `findOneAndUpdate` is atomic at the
storage-engine level: no other write can interleave between the overlap check and the push for
that document, which is what makes this safe under concurrency without needing a replica set or
`@nestjs/mongoose` transactions (the local MongoDB here is standalone). `CreateDutyUseCase` calls
this before persisting the `Duty` document itself; a `false` return means "conflict" and the use
case throws `DutyOverlapError` without touching the `duty` collection.

### GraphQL (Presentation)

Code-first GraphQL: `@ObjectType()` for output shapes, `@InputType()` for arguments, `@Resolver()`
for the resolver class. The resolver injects use-cases directly — thin, no business logic.

```typescript
// ✅ src/modules/duty/infrastructure/graphql/Duty.object-type.ts
import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DutyType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  assigneeId: string;

  @Field()
  startsAt: Date;

  @Field()
  endsAt: Date;

  @Field()
  status: string;
}
```

```typescript
// ✅ src/modules/duty/infrastructure/graphql/CreateDuty.input.ts
import { Field, InputType } from '@nestjs/graphql';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateDutyInput {
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Assignee is required' })
  assigneeId: string;

  @Field()
  @IsDate()
  startsAt: Date;

  @Field()
  @IsDate()
  endsAt: Date;
}
```

```typescript
// ✅ src/modules/duty/infrastructure/graphql/Duty.resolver.ts
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateDutyUseCase } from '../../application/use-cases/CreateDutyUseCase';
import { GetDutiesUseCase } from '../../application/use-cases/GetDutiesUseCase';
import { Duty } from '../../domain/entities/Duty';
import { CreateDutyInput } from './CreateDuty.input';
import { DutyType } from './Duty.object-type';

function toDutyType(duty: Duty): DutyType {
  return {
    id: duty.id.value,
    title: duty.title,
    assigneeId: duty.assigneeId,
    startsAt: duty.startsAt,
    endsAt: duty.endsAt,
    status: duty.status,
  };
}

@Resolver(() => DutyType)
export class DutyResolver {
  constructor(
    private readonly createDutyUseCase: CreateDutyUseCase,
    private readonly getDutiesUseCase: GetDutiesUseCase,
  ) {}

  @Query(() => [DutyType])
  async duties(): Promise<DutyType[]> {
    const duties = await this.getDutiesUseCase.execute();
    return duties.map(toDutyType);
  }

  @Mutation(() => DutyType)
  async createDuty(@Args('input') input: CreateDutyInput): Promise<DutyType> {
    const duty = await this.createDutyUseCase.execute(input);
    return toDutyType(duty);
  }
}
```

Domain entities are never returned directly from a resolver — always map through a
`toXxxType()` function, same reasoning as never serializing a domain object straight into an
HTTP response.

---

## Module Wiring (Composition Root)

```typescript
// ✅ src/modules/duty/duty.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreateDutyUseCase } from './application/use-cases/CreateDutyUseCase';
import { GetDutiesUseCase } from './application/use-cases/GetDutiesUseCase';
import { DutyRepository } from './application/ports/DutyRepository';
import {
  DutyDocument,
  DutySchema,
} from './infrastructure/persistence/duty.schema';
import { DutyRepositoryAdapter } from './infrastructure/persistence/DutyRepositoryAdapter';
import { DutyResolver } from './infrastructure/graphql/Duty.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DutyDocument.name, schema: DutySchema },
    ]),
  ],
  providers: [
    { provide: DutyRepository, useClass: DutyRepositoryAdapter },
    CreateDutyUseCase,
    GetDutiesUseCase,
    DutyResolver,
  ],
})
export class DutyModule {}
```

Register the feature module in `src/app.module.ts`'s `imports` array.

---

## Cross-module access

When a use-case in module A genuinely needs data owned by module B, export B's abstract
repository from its module and import B's module into A — then inject the abstract token:

```typescript
// modules/duty/duty.module.ts
@Module({
  providers: [{ provide: EmployeeRepository, useClass: EmployeeRepositoryAdapter }],
  exports: [EmployeeRepository], // export the abstract token, never the concrete adapter
})
```

```typescript
// modules/assignment/assignment.module.ts
@Module({ imports: [DutyModule] })
```

Never import a concrete adapter or another module's internal class directly — only its exported
abstract port.

---

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

---

## Adding a New Feature

1. **Start in `domain/`** — model the entity, value objects, policies, domain errors. No infra.
2. **Define the port** — abstract repository in `application/ports/`.
3. **Write the use-cases** — orchestrate domain + port in `application/use-cases/`.
4. **Implement adapters** — Mongoose schema + repository adapter, GraphQL resolver + types.
5. **Wire the module** — bind the abstract port to the concrete adapter in `<feature>.module.ts`.
6. **Register the module** — import it in `app.module.ts`.

---

## Anti-Patterns

### ❌ Business logic in the resolver

```typescript
// ❌ Bad
@Mutation(() => DutyType)
async createDuty(@Args('input') input: CreateDutyInput) {
  if (input.endsAt <= input.startsAt) throw new Error('Invalid window');
  return this.dutyModel.create(input);
}
```

Validation belongs in `Duty.create()`. Persistence belongs in the repository adapter. The
resolver's only job is to translate GraphQL into a use-case call.

### ❌ Domain importing NestJS, Mongoose, or GraphQL

```typescript
// ❌ Bad — domain entity with framework coupling
import { Prop, Schema } from '@nestjs/mongoose'; // ← infra in domain
import { Field, ObjectType } from '@nestjs/graphql'; // ← presentation in domain
```

### ❌ Use-case depending on the concrete adapter

```typescript
// ❌ Bad
constructor(private readonly repo: DutyRepositoryAdapter) {} // ← concrete type, can't fake in tests
```

### ❌ Returning a domain entity straight from a resolver

```typescript
// ❌ Bad — leaks internal shape, breaks if the entity changes
@Query(() => DutyType)
async duty(@Args('id') id: string) {
  return this.getDutyUseCase.execute(id); // returns a Duty, not a DutyType
}
```
