---
description: Backend code formatting — Prettier/oxlint config, GraphQL response mapping
globs: 'backend/oxlint.json, backend/.prettierrc, backend/src/**/*.resolver.ts'
alwaysApply: false
---

# Code Style & Response Mapping — backend

## Formatting — Prettier + oxlint

Formatting is handled by **Prettier**; linting by **oxlint** (the Rust-based linter the Nest CLI
scaffolded this project with — not ESLint).

```bash
cd backend
pnpm format   # if/when a format script is added — for now: npx prettier --write "src/**/*.ts"
pnpm lint     # oxlint src/ test/
```

Current config:

- `.prettierrc` — `singleQuote: true`, `trailingComma: "all"`. No tabs-vs-spaces override; default
  2-space indentation applies everywhere in this repo.
- `oxlint.json` — `@typescript-eslint/no-explicit-any` is off (tracked as a follow-up, not a
  license to reach for `any` casually), `@typescript-eslint/no-floating-promises` is a warning.

If oxlint flags something, fix the code — don't add a suppression comment unless there's a
documented reason.

---

## Rule: never expose a domain entity directly

Domain entities must **never** be returned directly from a resolver. Always map through a
`toXxxType()` function into the GraphQL `@ObjectType()`.

```typescript
// ❌ Bad — domain object leaking into the GraphQL response
@Query(() => DutyType)
async duty(@Args('id') id: string): Promise<Duty> {
  return this.getDutyUseCase.execute(id); // wrong return type, exposes internal shape
}

// ✅ Good — always map through a response function
@Query(() => DutyType)
async duty(@Args('id') id: string): Promise<DutyType> {
  const duty = await this.getDutyUseCase.execute(id);
  return toDutyType(duty);
}
```

## Response mapper functions

Mappers are plain functions — no classes — colocated with the resolver or in the same
`infrastructure/graphql/` folder as `<Entity>.mapper.ts` once a module has more than one place
that needs the mapping.

```typescript
// ✅ src/modules/duty/infrastructure/graphql/Duty.mapper.ts
import type { Duty } from '../../domain/entities/Duty';
import type { DutyType } from './Duty.object-type';

export function toDutyType(duty: Duty): DutyType {
  return {
    id: duty.id.value,
    title: duty.title,
    assigneeId: duty.assigneeId,
    startsAt: duty.startsAt,
    endsAt: duty.endsAt,
    status: duty.status,
  };
}
```

## Naming

- Mapper functions follow the pattern `to<Entity>Type` (e.g. `toDutyType`).
- GraphQL object type field names match the domain entity's public getters — don't rename fields
  between the domain and the GraphQL shape without a reason; it makes the mapper a pure
  passthrough that's easy to verify at a glance.
- Never create a separate "ViewModel" class — a plain function is enough.
