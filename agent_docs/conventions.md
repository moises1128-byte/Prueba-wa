---
description: Repo-wide conventions — no magic strings, typed-array enum pattern
globs: "**/*.ts, **/*.tsx"
alwaysApply: false
---

# Repo-wide conventions

## No magic strings — typed-array enum pattern

Never use TypeScript's `enum` keyword (it compiles to a runtime object with bidirectional
mapping issues, and doesn't tree-shake well). Instead, define a `const` array + derived type,
and a small local helper when you need a value→label or validity-check object:

```ts
export const dutyStatuses = ['pending', 'assigned', 'completed', 'cancelled'] as const;
export type TDutyStatus = (typeof dutyStatuses)[number];

// Local helper — no external package needed, this project has no shared @repo/utils
export function getEnumObjectFromArray<T extends readonly string[]>(
  values: T,
): { [K in T[number]]: K } {
  return Object.fromEntries(values.map((v) => [v, v])) as { [K in T[number]]: K };
}

export const dutyStatusObject = getEnumObjectFromArray(dutyStatuses);
// dutyStatusObject.pending === 'pending', with autocomplete and type safety
```

Put the helper once in `backend/src/shared/utils/getEnumObjectFromArray.ts` (or the frontend
equivalent under `frontend/src/shared/utils/`) and import it — don't redefine it per module.

## Validation error messages

Keep validation messages plain and human-readable at the point they're defined (Zod schema,
`class-validator` decorator, GraphQL input). There is no i18n dictionary in this project — if
bilingual messages become a requirement later, that's a deliberate addition, not a default.

```ts
// Backend — class-validator on a GraphQL InputType
@Field()
@IsNotEmpty({ message: 'Name is required' })
name: string;
```
