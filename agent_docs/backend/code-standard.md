---
description: Backend TypeScript/NestJS code conventions — naming, patterns, GraphQL validation
globs: "backend/src/**/*.ts"
alwaysApply: false
---

# Code Standards — backend

Keep changes consistent with this repo. Prefer clarity, small diffs, and predictable patterns.

---

## File & export conventions

- **camelCase** for files and folders (e.g. `createDutyUseCase.ts`, `dutyResolver.ts`), except
  class files which match the class's `PascalCase` name (e.g. `Duty.ts`, `DutyRepository.ts`) —
  follow whichever convention `agent_docs/backend/module-patterns.md` shows for that file's role.
- **One class per file**; file name must match the class name.
- Prefer **named exports**; avoid default exports except where NestJS requires them.
- Avoid **barrel exports** (`index.ts`) — they hide boundaries and slow down tooling.
- Co-locate files by feature inside `src/modules/<feature>/`; don't move code to `shared/`
  speculatively — promote only when two or more modules need the same thing.

---

## TypeScript

- **Strict**: no `any`, no `as any`, no unsafe coercion.
- Prefer **interfaces** for object shapes (`DutyProps`); use `type` for unions/mapped types.
- Add **explicit return types** on all public methods and exported functions.
- Keep types close to usage; only promote to `shared/` when two or more modules need them.
- Validate **external data** (GraphQL input) with `class-validator` decorators on `@InputType()`
  classes — the global `ValidationPipe` enforces them before the resolver runs. Never trust raw
  input inside use-cases or domain.
- Use **`type` imports** when importing only for type checking (`import type { Duty } from ...`).

---

## NestJS / GraphQL patterns

- **Resolvers** are thin. They parse the GraphQL arguments, call a use-case, and map the result to
  an `@ObjectType()`. No logic.
- **Use-cases** are `@Injectable()` classes with a single `execute()` method. They sequence
  operations — no business rules (those live in the domain).
- **Domain classes** (entities, value objects, policies) have zero NestJS imports, zero Mongoose
  imports, zero GraphQL decorators.
- **Repository adapters** implement the abstract repository class from `application/ports/`.
- Never put `@Module()` logic in `app.module.ts` beyond importing feature modules; each feature
  owns its own `<feature>.module.ts`.

---

## Async & data work

- Prefer **async/await** over `.then()`.
- Parallelize independent async work with **`Promise.all`**.
- Never `await` inside a loop for independent operations.
- Never return a raw Mongoose document to the application or presentation layer — always map to
  the domain entity in the repository adapter (`toDomain()` / `toDocument()`).

---

## Naming conventions

See the table in `agent_docs/backend/module-patterns.md` — it's the single source of truth for
per-role naming (`Entity`, `UseCase`, `Repository`, `Resolver`, GraphQL `Type`/`Input`, etc.).

---

## Error handling

- Domain errors are plain TypeScript classes extending `DomainError`. Never throw a NestJS
  `HttpException`-family error, and never throw a bare `Error`, from the domain or application
  layer.
- Errors are mapped to the GraphQL error shape once, globally, via `formatError` — see
  `agent_docs/backend/error-handling.md`. Don't add per-resolver try/catch for this.
- Don't add error handling "just in case"; handle expected errors explicitly.
- Never leak internal error details (stack traces, DB messages) in GraphQL responses.

---

## API documentation

GraphQL is self-documenting via schema introspection. Apollo Sandbox (served automatically at
`/graphql` in development, from a browser) is the interactive docs and query explorer — there is
no Swagger/OpenAPI setup in this project and none is needed for a GraphQL API. If you add a
`@Field()` or argument whose purpose isn't obvious from its name, add a short `description` option
to the decorator (`@Field({ description: '...' })`) — that string surfaces directly in the
Sandbox and in introspection queries.

---

## General

- Prefer **function declarations** over arrow functions for methods and handlers.
- Prefer **composition** over inheritance in domain classes.
- Avoid comments that describe *what* the code does; write comments only when explaining *why*.
- Tests are the documentation for behavior — prefer tests over prose explanations.
