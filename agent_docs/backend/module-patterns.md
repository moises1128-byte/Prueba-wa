---
description: Checklist and conventions for adding a new backend module (NestJS + Hexagonal + GraphQL + Mongoose)
globs: "backend/src/modules/**/*.ts"
alwaysApply: false
---

# Module Patterns — backend

Companion checklist to `agent_docs/backend/architecture.md`. Read that first for the full
zone-by-zone explanation and code examples — this file is the quick reference when adding a new
module.

---

## Folder structure

```
src/modules/<moduleName>/
├── domain/
│   ├── entities/<Entity>.ts
│   ├── value-objects/<ValueObject>.ts
│   ├── policies/<Entity>Policy.ts        (only if a cross-field rule needs one)
│   └── errors/<Entity>Errors.ts
├── application/
│   ├── ports/<Entity>Repository.ts       (abstract class)
│   └── use-cases/<Action><Entity>UseCase.ts
├── infrastructure/
│   ├── persistence/
│   │   ├── <entity>.schema.ts            (Mongoose @Schema)
│   │   └── <Entity>RepositoryAdapter.ts
│   └── graphql/
│       ├── <Entity>.resolver.ts
│       ├── <Entity>.object-type.ts
│       └── <Action><Entity>.input.ts
└── <moduleName>.module.ts
```

---

## Naming conventions

| Concept | Convention | Example |
|---|---|---|
| Entity | `PascalCase`, noun | `Duty` |
| Value object | `PascalCase`, noun | `DutyId` |
| Domain policy | `PascalCase` + `Policy` | `DutyOverlapPolicy` |
| Domain error | `PascalCase` + `Error`, extends `DomainError` | `DutyNotFoundError` |
| Use-case | `PascalCase` + `UseCase` | `CreateDutyUseCase` |
| Repository port | `PascalCase` + `Repository` | `DutyRepository` |
| Repository adapter | `PascalCase` + `RepositoryAdapter` | `DutyRepositoryAdapter` |
| Resolver | `PascalCase` + `Resolver` | `DutyResolver` |
| GraphQL object type | `PascalCase` + `Type` | `DutyType` |
| GraphQL input type | `PascalCase` + `Input` | `CreateDutyInput` |
| Module file | `<moduleName>.module.ts` | `duty.module.ts` |

---

## Mongoose schema conventions

- One schema per module, in `infrastructure/persistence/<entity>.schema.ts`. No central schema
  aggregation file — with a handful of modules there's no aggregation problem to solve yet. If the
  module count grows and cross-collection relations become hard to trace, revisit this.
- Use `{ timestamps: true }` in `@Schema()` options instead of hand-rolled `createdAt`/`updatedAt`.
- No soft-delete convention by default (no `isActive` column). Add one only if a spec explicitly
  requires recoverable/undoable records.
- Reference another module's document by storing its Mongo `_id` as a `string` (or
  `Types.ObjectId` with `ref: '<OtherDocument>.name'` if you need `.populate()`), never by
  importing the other module's schema file directly into your own — that's a cross-module
  boundary violation symmetrical to the "no cross-module repository injection without an exported
  port" rule below.

## GraphQL conventions

- Code-first only (`@nestjs/graphql` decorators) — no hand-written `.graphql` SDL files.
- One `@ObjectType()` per entity's public shape, one `@InputType()` per mutation argument set
  (`Create<Entity>Input`, `Update<Entity>Input`). Don't reuse the same input type for create and
  update if the required/optional fields differ.
- `class-validator` decorators (`@IsString()`, `@IsNotEmpty()`, etc.) go directly on the
  `@InputType()` fields — NestJS's global `ValidationPipe` validates them automatically. There is
  no Zod-based DTO layer in this project (no `@repo/schemas`, no `createZodDto`).
- Resolvers inject use-cases directly via constructor DI. No CQRS bus (`CommandBus`/`QueryBus`) —
  this project doesn't have the cross-module fan-out that justifies one. If that changes, adding
  `@nestjs/cqrs` is a deliberate, documented decision, not a default.

## Error handling

- Throw `DomainError` subclasses from the domain/application layers — never a NestJS
  `HttpException` from there.
- Let them propagate; a global `GraphQLExceptionFilter` (or Apollo's `formatError`) maps them to
  the GraphQL error shape. See `agent_docs/backend/error-handling.md`.

## Registration in `<moduleName>.module.ts`

```typescript
@Module({
  imports: [MongooseModule.forFeature([{ name: DutyDocument.name, schema: DutySchema }])],
  providers: [
    { provide: DutyRepository, useClass: DutyRepositoryAdapter },
    CreateDutyUseCase,
    GetDutiesUseCase,
    UpdateDutyUseCase,
    DeleteDutyUseCase,
    DutyResolver,
  ],
})
export class DutyModule {}
```

Register every use-case as a plain provider (not `{ provide: Port, useClass: UseCase }` — that
indirection is only useful with CQRS's port/handler split, which this project doesn't use).

## Cross-module repository injection

When module A's use-case needs data owned by module B:

1. Module B exports its abstract repository token (never the concrete adapter):
   ```typescript
   @Module({ providers: [...], exports: [EmployeeRepository] })
   export class EmployeeModule {}
   ```
2. Module A imports module B: `@Module({ imports: [EmployeeModule] })`.
3. Module A's use-case injects the abstract token: `constructor(private readonly employeeRepository: EmployeeRepository) {}`.

## New module checklist

- [ ] `domain/entities/<Entity>.ts` with `create()` (validates) and `restore()` (trusts stored data)
- [ ] Value objects for typed IDs / anything primitive-obsession-prone
- [ ] Domain errors extending `DomainError`
- [ ] Abstract `<Entity>Repository` in `application/ports/`
- [ ] Use-cases in `application/use-cases/` — one per operation, `@Injectable()`, single `execute()`
- [ ] Mongoose schema in `infrastructure/persistence/<entity>.schema.ts`
- [ ] `<Entity>RepositoryAdapter` implementing the abstract repository
- [ ] `@ObjectType()` and `@InputType()` classes in `infrastructure/graphql/`
- [ ] `<Entity>Resolver` — injects use-cases, maps domain → `@ObjectType()`, never returns a raw entity
- [ ] Register everything in `<moduleName>.module.ts`
- [ ] Import the module in `src/app.module.ts`
- [ ] Unit tests for domain (entity/value-object/policy) and use-cases (mocked repository) — see `agent_docs/backend/testing.md`
