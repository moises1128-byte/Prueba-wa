---
description: Frontend TypeScript/React code conventions — naming, exports, Apollo Client, CSS Modules stack
globs: 'frontend/src/**/*.tsx, frontend/src/**/*.ts'
alwaysApply: false
---

# Code Standards (Frontend)

Keep changes consistent with this repo. Prefer clarity, small diffs, and predictable patterns.

## File & export conventions

- Use **camel-case** for files and folders.
- **One React component per file** (1 exported component).
- Prefer **named exports** (`export function X()`); Next.js **route files** (`page.tsx`,
  `layout.tsx`, `error.tsx`, `loading.tsx`) may use **default exports**.
- Avoid **barrel exports** (`index.ts`) unless there's a proven reuse need across many callers.
- Co-locate files by feature; don't move code to `shared/` "just in case" — promote only when 2+
  features need the same thing (see `agent_docs/frontend/import-boundaries.md`).

## Naming conventions (file suffixes by layer)

| Layer / Artifact | Suffix | Example |
|---|---|---|
| Domain model | `*.model.ts` | `duty.model.ts` |
| Domain logic | `*.logic.ts` | `duty.logic.ts` |
| Domain constants | `*.constants.ts` | `duty.constants.ts` |
| Form schema | `*.form.ts` | `duty.form.ts` |
| Infrastructure GraphQL document | `*.graphql.ts` | `duties.graphql.ts` |
| Infrastructure transform | `*.transform.ts` | `duties.transform.ts` |
| Application query hook | `use*.query.ts` | `useDuties.query.ts` |
| Application mutation hook | `use*.mutation.ts` | `useCreateDuty.mutation.ts` |
| Application use case | `*.useCase.ts` | `createDutyFlow.useCase.ts` |
| UI atom / molecule | descriptive PascalCase, in `atoms/`/`molecules/` | `Button.tsx`, `DutyStatusBadge.tsx` |
| UI organism | PascalCase + `Organism`, in `organisms/` | `DutyListOrganism.tsx` |
| UI template | PascalCase + `Template`, in `templates/` | `DutySchedulerTemplate.tsx` |
| UI page | PascalCase + `Page`, in `pages/` | `DutySchedulerPage.tsx` |
| Server Action file | `actions.ts` | `app/duties/actions.ts` |

The file name for a `.tsx` component is camelCase and matches its component:
`dutyStatusBadge.tsx` exports `function DutyStatusBadge()`. See
`agent_docs/frontend/component-structure.md` for the full naming rule per Atomic Design level.

## Import order

Nothing enforces import order in this repo — write imports in whatever order reads well. Use
`import type` for type-only imports.

## TypeScript

- **Strict**: no `any`, no `as any`, no unsafe coercion.
- Prefer **interfaces** for object shapes; use **type** for unions/mapped types.
- Add **explicit return types** for exported/public functions.
- Keep types close to usage; use `types.ts` only when shared inside a module.
- Validate **external data** (GraphQL responses via transforms, forms, env) with **Zod** where
  meaningful.

## React & Next.js

- Prefer **Server Components** for pages/templates; push `'use client'` down to organisms that
  need Apollo Client hooks or interactivity — see `agent_docs/frontend/layers/ui.md`.
- Client components only for **interactivity / data fetching**; keep them small.
- Use React APIs via **`React.*`** (import React, avoid importing hooks directly).
- Components must be **function declarations** (no React arrow components).
- Prefer composition over prop drilling; avoid passing props more than ~3 levels.

## UI / Styling

- **CSS Modules** — see `agent_docs/frontend/styling.md`. No Tailwind, no `@repo/ui`, no
  component-library dependency in this project unless deliberately added later.
- Build **responsive** UI (mobile-first).
- Organize components with **Atomic Design** — see `agent_docs/frontend/architecture.md`.

## Async & data work

- Prefer **async/await** over `.then()`.
- Parallelize independent work with **`Promise.all`**.
- Avoid `await` inside loops for independent operations.
- Use **Apollo Client** (`useQuery`/`useMutation`) for GraphQL server-state — see
  `agent_docs/frontend/data-fetching.md`.
- Keep GraphQL response shapes out of UI; return **domain-shaped** data from application-layer hooks.

## Rendering & readability

- Prefer **ternaries** (`condition ? <X /> : null`) over `&&` for conditional rendering — avoids
  rendering `0`, `""`, or `NaN` when the condition isn't strictly boolean.
- Avoid nested ternaries; move branching outside JSX.
- Destructure props in the function signature; define defaults there.
- Avoid uncontrolled prop spreading (`{...props}`) unless intentional and typed.

## Error handling

- Use Apollo Client's own `loading`/`error`/`data` at the query/mutation boundary — there is no
  `Safe<T>` wrapper in this project.
- Application use cases: return `{ ok: true, data } | { ok: false, error }` — never throw.
- Server Actions: return `{ success, ... }` — never throw.
- UI: route-level `error.tsx` for unexpected failures. Organisms handle their own error states via
  the query hook's `error`.
- Don't add error handling "just in case".
- See `agent_docs/frontend/error-handling.md` for the full pattern.
