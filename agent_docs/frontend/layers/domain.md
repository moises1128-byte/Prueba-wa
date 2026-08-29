---
description: Domain layer — entity interfaces, typed enums, Zod form schemas, pure logic functions
globs: 'frontend/src/features/**/domain/*.ts'
alwaysApply: false
---

# Domain Layer

The innermost layer. Defines what things _are_ — entities, rules, constraints, and vocabulary. Every other layer depends on Domain; Domain depends on nothing.

---

## Purity rule

Domain code has **zero framework dependencies**. No `next/*`, no `react`, no ORM imports. Only stdlib and Zod (for validators).

Test: if you delete `node_modules` for all frameworks, domain files should still compile.

---

## Models (`*.model.ts`)

Domain entities are readonly TypeScript interfaces. They represent the business's language, not the database schema or API response shape.

```typescript
// features/habits/domain/habit.model.ts
export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly status: THabitStatus;
  readonly userId: string; // Relations by ID, not nested objects
  readonly createdAt: Date;
  readonly completedAt: Date | null; // Explicit null, not optional
}
```

Rules:

- **Readonly fields** — Entities are immutable data. Mutations create new instances.
- **Relations by ID** — `userId: string`, not `user: User`. Avoids deep nesting and circular references.
- **Explicit null vs optional** — Use `null` for "no value" (the field exists but is empty). Use `?` for "may not be present" (the field may not exist).
- **No methods with I/O** — No `async`, no `fetch`, no database calls.
- **No serialization** — No `toJSON()`, `toDTO()`. That's infrastructure's job.

---

## Constants & enums (`*.constants.ts`)

Use the typed-array enum pattern with the local `getEnumObjectFromArray` helper (there is no
`@repo/utils` package in this project). See `agent_docs/conventions.md` for the full pattern.

```typescript
// features/duties/domain/duty.constants.ts
import { getEnumObjectFromArray } from '@/shared/utils/getEnumObjectFromArray';

export const dutyStatuses = [
  'pending',
  'assigned',
  'completed',
  'cancelled',
] as const;
export type TDutyStatus = (typeof dutyStatuses)[number];
export const dutyStatusObject = getEnumObjectFromArray(dutyStatuses);
```

Apollo Client caches by the GraphQL document + variables automatically — this project has no
manual query-key registry to maintain (unlike a REST + React Query setup). If a feature needs a
stable identifier for something else (e.g. a `localStorage` key), define it here as a plain
constant.

Never use TypeScript's `enum` keyword. It compiles to a runtime object with bidirectional mapping issues.

---

## Validators & form schemas (`*.form.ts`)

Zod schemas define validation rules. They run on both client (react-hook-form) and server (Server Actions).

```typescript
// features/habits/domain/habits.form.ts
import { z } from 'zod';

export const createHabitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  frequency: z.enum(['daily', 'weekly']),
});

export type TCreateHabitForm = z.infer<typeof createHabitSchema>;

export function createHabitDefaultValues(): TCreateHabitForm {
  return { name: '', description: '', frequency: 'daily' };
}
```

Rules:

- Always use `.safeParse()` (returns typed result), never `.parse()` (throws).
- Compose sub-schemas for reuse: `emailSchema`, `passwordSchema`, `paginationSchema`.
- Use `.superRefine()` for cross-field validation (e.g., password confirmation).
- Validation that depends on app state (e.g., "email not already taken") belongs in a use case, not a schema.

---

## Pure logic (`*.logic.ts`)

Business rules as pure functions. No side effects, no I/O, no framework imports.

```typescript
// features/habits/domain/habit.logic.ts
import type { Habit, THabitStatus } from './habit.model';

export function canCompleteHabit(habit: Habit): boolean {
  return habit.status === 'active' && habit.completedAt === null;
}

export function getHabitStreak(completions: Date[]): number {
  // Pure calculation — no side effects
  let streak = 0;
  // ... calculate consecutive days
  return streak;
}
```

If a rule is used by one feature only, keep it in that feature's `domain/`. If shared across features, promote to `shared/domain/`.

---

## Anti-patterns

- **Types derived from the GraphQL schema** — Don't `import type { Duty } from '../infrastructure/duties.graphql'` and use the raw generated/inferred shape as the domain model. Define domain types independently in `*.model.ts`; the transform layer bridges the two.
- **Async in domain** — Domain functions are synchronous and pure. If it needs I/O, it belongs in infrastructure or application.
- **Business logic in entities** — Entities define shape, not behavior. Put rules in `*.logic.ts` or use cases.
- **`.parse()` with try/catch** — Use `.safeParse()` which returns a typed result without throwing.
- **Importing framework code** — No `next/navigation`, no `react`, no `@apollo/client` in domain files.
