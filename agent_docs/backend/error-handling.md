---
description: Backend error handling — DomainError subclasses, GraphQL error formatting
globs: 'backend/src/**/domain/errors/*.ts, backend/src/main.ts'
alwaysApply: false
---

# Error Handling

## Architecture

```text
Domain layer         → throws DomainError subclasses (pure TypeScript, no NestJS)
Application layer    → use-cases let DomainError propagate, no try-catch
Presentation layer    → Apollo's formatError (or a GraphQLExceptionFilter) maps it to a GraphQL error
```

There is no i18n dictionary and no bilingual message system in this project — every message is a
plain, human-readable English (or Spanish, pick one and stay consistent per module) string set
where the error is thrown.

## Base class

```typescript
// src/shared/errors/domain-error.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}
```

## Per-module errors

```typescript
// src/modules/duty/domain/errors/DutyErrors.ts
import { DomainError } from '../../../../shared/errors/domain-error';

export class DutyNotFoundError extends DomainError {
  readonly code = 'dutyNotFound';
  constructor() {
    super('Duty not found');
  }
}

export class DutyOverlapError extends DomainError {
  readonly code = 'dutyOverlap';
  constructor(conflictingDutyId: string) {
    super(`Duty overlaps with existing duty ${conflictingDutyId}`);
  }
}
```

Throw from the use-case or repository adapter — never catch and rethrow in the resolver.

```typescript
// use-case
const existing = await this.dutyRepository.findById(id);
if (!existing) throw new DutyNotFoundError();
```

## GraphQL error shape

Apollo Server's default error shape already includes `message`, `extensions.code` (from
`ApolloServerErrorCode` or a custom code), and `path`. Map `DomainError.code` into
`extensions.code` via `formatError` in the GraphQL module config so every error the client sees
carries a stable, matchable code:

```typescript
// app.module.ts — GraphQLModule.forRoot(...)
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
  formatError: (formattedError, error) => {
    const original = (error as { originalError?: unknown }).originalError;
    if (original instanceof DomainError) {
      return {
        message: original.message,
        extensions: { code: original.code },
      };
    }
    // Unexpected errors — don't leak internals (stack traces, DB messages) to the client
    return { message: 'Internal server error', extensions: { code: 'internalError' } };
  },
}),
```

Resulting client-visible shape:

```json
{
  "errors": [
    { "message": "Duty not found", "extensions": { "code": "dutyNotFound" } }
  ]
}
```

## Where each error belongs

```
✅ modules/<x>/domain/errors/   → module business errors
✅ shared/errors/domain-error.ts → abstract base class only
❌ domain/entities/             → never throw plain Error, always a DomainError subclass
❌ resolvers/                   → never catch/rethrow — formatError handles it globally
```

## Validation errors (GraphQL input)

Input validation (`class-validator` on `@InputType()` fields) is handled by NestJS's global
`ValidationPipe` before the resolver method runs — it throws before your code sees the request,
and Apollo formats it as a normal GraphQL error with `extensions.code: 'BAD_USER_INPUT'`. You
don't need a `DomainError` for "this field is required" — that's shape validation, not a business
rule.

## Checklist for a new domain error

- [ ] Class in `modules/<domain>/domain/errors/<Domain>Errors.ts`, extends `DomainError`
- [ ] `readonly code` — camelCase, unique across the app
- [ ] Thrown from the use-case or repository adapter, not caught anywhere in between
- [ ] If it needs a distinct HTTP-adjacent meaning (not found vs. conflict), that's expressed by
      the `code` alone — GraphQL has one transport-level status, there's no per-error HTTP code to pick
