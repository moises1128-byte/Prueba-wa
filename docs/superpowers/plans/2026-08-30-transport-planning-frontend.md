# Transport Planning Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Next.js frontend for the transport-planning MVP: a `/units` CRUD page, a `/routes` list + create page, and a `/routes/[id]` detail page (map + duties + edit/delete) against the already-implemented GraphQL backend.

**Architecture:** Feature-driven Clean Architecture per `agent_docs/frontend/architecture.md` (UI → Application → Infrastructure → Domain, Atomic Design inside UI). Two features: `units` (full CRUD, no sub-resources) and `routes` (routes CRUD + the map + duty scheduling, since duties are only ever surfaced through a route's detail page — there is no standalone `/duties` route in the approved spec, so Duty's domain/application/infrastructure/UI lives inside the `routes` feature rather than as its own feature slice; this keeps "delete `features/<x>`, the rest still compiles" true for both).

**Tech Stack:** Next.js 16 (App Router) + React 19, Apollo Client v4, react-hook-form + Zod v4, CSS Modules, react-leaflet v5 + Leaflet 1.9 (OpenStreetMap tiles), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-transport-planning-mvp-design.md` — see §6 (frontend pages/flows) and §7 (testing plan); the backend GraphQL schema it specifies is now real at `backend/src/schema.gql` and was re-verified against the actual running code before writing this plan.

## Global Constraints

- All file names, function names, class names, and identifiers in English (confirmed hard rule from the backend plan; applies here too), regardless of UI copy language. UI copy in this plan is English; translate at your discretion if the assessment expects Spanish copy, but keep identifiers English either way.
- Feature-driven Clean Architecture: `UI → Application → Infrastructure → Domain`. No feature imports another feature (`agent_docs/frontend/import-boundaries.md`). Promote to `shared/` only when 2+ features need something.
- Atomic Design inside the UI layer: atoms/molecules → `shared/ui/` (generic) or `features/<f>/ui/` (feature-specific); organisms own their own loading/error/empty state; templates never fetch; pages are thin (`agent_docs/frontend/architecture.md`).
- CSS Modules only, tokens as CSS custom properties in `app/globals.css` — no Tailwind (`agent_docs/frontend/styling.md`).
- Components are function declarations, one exported component per file, camelCase file names, PascalCase component names, `Organism`/`Template`/`Page` suffixes (`agent_docs/frontend/code-standard.md`, `component-structure.md`).
- Forms: `react-hook-form` + `zodResolver`, split into `*.form.ts` (Zod schema, domain), `*Organism.tsx` (owns `useForm` + mutation, UI), `*FormContent.tsx` (fields only, UI molecule) — `agent_docs/frontend/forms.md`.
- **Apollo Client is v4.2.12 (confirmed installed version), not the v3-era API `agent_docs/frontend/*` currently documents.** Task 1 corrects those docs before any feature code is written, so every later task follows the real API:
  - `ApolloClient`, `InMemoryCache`, `gql` from `@apollo/client` (unchanged).
  - `ApolloProvider`, `useQuery`, `useMutation` from `@apollo/client/react` (moved out of the root package).
  - `HttpLink` from `@apollo/client/link/http` (moved out of the root package).
  - `MockedProvider` from `@apollo/client/testing/react` (moved out of `@apollo/client/testing`).
  - The mutation/query `error` is no longer a monolithic `ApolloError` with `.graphQLErrors` — it's `ErrorLike`; check `CombinedGraphQLErrors.is(error)` from `@apollo/client/errors`, then read `error.errors[0]?.extensions?.code`. A shared `getGraphQLErrorCode()` helper (Task 2) wraps this everywhere.
- Backend domain error codes to match on (verbatim, confirmed against `backend/src/modules/*/domain/errors/*.ts`): `routeNotFound`, `invalidRoutePoint`, `routeHasActiveDuties`, `unitNotFound`, `invalidUnit`, `unitHasActiveDuties`, `dutyNotFound`, `invalidDutyWindow`, `dutyOverlap`, `dutyReservationLost`, plus `badUserInput` (input validation) and `internalError` (fallback).
- Testing: Vitest + React Testing Library, files under `frontend/src/test/<feature>/<layer>/*.test.ts(x)` (never co-located), mock at the Apollo boundary with `MockedProvider` (`agent_docs/frontend/testing.md`).
- The backend must be running on `http://localhost:3001/graphql` for manual verification (`cd backend && pnpm start:dev`, per `README.md`) and MongoDB must be running locally — both already set up from the backend work.
- Next.js 16 breaking-changes note: this repo's `frontend/AGENTS.md` warns the installed Next.js version differs from training-era knowledge. Verified directly against `frontend/node_modules/next/dist/docs/`: dynamic route `params` is a `Promise`, typed via the `PageProps<'/routes/[id]'>` / `LayoutProps<'/'>` helpers, and must be `await`ed in an `async` page component.

---

## Task 1: Tooling — dependencies, Vitest, and Apollo Client v4 doc corrections

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/.env.example`
- Modify: `agent_docs/frontend/layers/infrastructure.md`
- Modify: `agent_docs/frontend/layers/application.md`
- Modify: `agent_docs/frontend/data-fetching.md`
- Modify: `agent_docs/frontend/error-handling.md`
- Modify: `agent_docs/frontend/testing.md`

**Interfaces:**
- Produces: `getGraphQLErrorCode` is NOT defined here (Task 2) but every later task's mutation-error handling depends on the corrected import paths documented in this task.

- [ ] **Step 1: Install dependencies**

Run from `frontend/`:

```bash
cd frontend
pnpm add @apollo/client@^4.2.12 graphql@^17.0.2 react-hook-form@^7.87.0 @hookform/resolvers@^5.9.1 zod@^4.5.4 leaflet@^1.9.4 react-leaflet@^5.0.0
pnpm add -D vitest@^4.1.11 @vitejs/plugin-react@^6.1.1 vite@^8.2.2 vite-tsconfig-paths@^6.1.1 jsdom@^30.0.1 @testing-library/react@^16.3.3 @testing-library/jest-dom@^7.0.1 @testing-library/user-event@^14.6.6 @types/leaflet@^1.9.22
```

- [ ] **Step 2: Add the `test` script**

Edit `frontend/package.json`'s `scripts` block to add:

```json
"test": "vitest run",
```

(Keep the existing `dev`, `build`, `start`, `lint`, `format`, `format:check` scripts unchanged.)

- [ ] **Step 3: Write the Vitest config**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
```

`passWithNoTests` keeps this task's own verification green before any feature test exists — remove it once Task 3 adds real tests if you prefer stricter CI later (not required for this MVP).

- [ ] **Step 4: Write the test setup file**

Create `frontend/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add the frontend env example**

Create `frontend/.env.example`:

```
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3001/graphql
```

- [ ] **Step 6: Run the test harness to verify it's wired**

```bash
pnpm test
```

Expected: Vitest runs with 0 test files and exits 0 (thanks to `passWithNoTests`).

- [ ] **Step 7: Correct `agent_docs/frontend/layers/infrastructure.md` for Apollo Client v4**

Replace:

```typescript
// lib/apolloClient.ts
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_URL }),
  cache: new InMemoryCache(),
});
```

with:

```typescript
// lib/apolloClient.ts
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_URL }),
  cache: new InMemoryCache(),
});
```

And replace:

```tsx
// context/apolloProvider.tsx
'use client';

import { ApolloProvider } from '@apollo/client';
import { apolloClient } from '@/lib/apolloClient';
```

with:

```tsx
// context/apolloProvider.tsx
'use client';

import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apolloClient';
```

Add a one-line note directly above the first code block: `> Apollo Client v4 split its exports across subpaths — the root package no longer re-exports React bindings or link constructors.`

- [ ] **Step 8: Correct `agent_docs/frontend/layers/application.md` for Apollo Client v4**

In both the "Queries" and "Mutations" code samples, replace:

```typescript
import { useQuery } from '@apollo/client';
```

with:

```typescript
import { useQuery } from '@apollo/client/react';
```

and:

```typescript
import { useMutation } from '@apollo/client';
```

with:

```typescript
import { useMutation } from '@apollo/client/react';
```

- [ ] **Step 9: Correct `agent_docs/frontend/data-fetching.md` for Apollo Client v4**

Replace every:

```typescript
import { useQuery } from '@apollo/client';
```

and

```typescript
import { useMutation } from '@apollo/client';
```

with the `/react` subpath equivalents, same as Step 8. Also replace:

```typescript
import { gql } from '@apollo/client';
```

— leave this one as-is (`gql` still lives at the root); do not change it.

- [ ] **Step 10: Correct `agent_docs/frontend/error-handling.md` for Apollo Client v4's real error shape**

Replace the section:

```markdown
`ApolloError` distinguishes network errors (`error.networkError`) from GraphQL errors returned by
the server (`error.graphQLErrors`) — each item in `graphQLErrors` carries `extensions.code`, the
same domain error code the backend attaches (see `agent_docs/backend/error-handling.md`).

```typescript
if (error?.graphQLErrors[0]?.extensions?.code === 'dutyOverlap') {
  // matched a specific backend domain error
}
```
```

with:

```markdown
Apollo Client v4 replaced the monolithic `ApolloError` with distinct error classes exported from
`@apollo/client/errors`. A GraphQL error returned in the server response's `errors` array arrives
as `CombinedGraphQLErrors` — check with its `.is()` guard, then read `.errors[0]?.extensions?.code`,
the same domain error code the backend attaches (see `agent_docs/backend/error-handling.md`). Use
the shared `getGraphQLErrorCode()` helper (`frontend/src/shared/utils/getGraphQLErrorCode.ts`)
instead of repeating this check inline.

```typescript
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';

if (getGraphQLErrorCode(error) === 'dutyOverlap') {
  // matched a specific backend domain error
}
```
```

And update the use-case example's catch block from:

```typescript
    const code = isApolloError(error)
      ? error.graphQLErrors[0]?.extensions?.code
      : undefined;
    if (code === 'dutyOverlap')
```

to:

```typescript
    const code = getGraphQLErrorCode(error);
    if (code === 'dutyOverlap')
```

(dropping the now-nonexistent `isApolloError` import from that example).

- [ ] **Step 11: Correct `agent_docs/frontend/testing.md` for Apollo Client v4**

Replace:

```tsx
import { MockedProvider } from '@apollo/client/testing';
```

with:

```tsx
import { MockedProvider } from '@apollo/client/testing/react';
```

- [ ] **Step 12: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/vitest.config.ts frontend/src/test/setup.ts frontend/.env.example agent_docs/frontend/layers/infrastructure.md agent_docs/frontend/layers/application.md agent_docs/frontend/data-fetching.md agent_docs/frontend/error-handling.md agent_docs/frontend/testing.md
git commit -m "chore(frontend): install deps, wire Vitest, correct docs for Apollo Client v4's real API"
```

(If the root `pnpm-lock.yaml` also changed, include it too: `git add pnpm-lock.yaml`.)

---

## Task 2: Shared foundation — Apollo wiring, routes, design tokens, atoms/molecules

**Files:**
- Create: `frontend/src/lib/apolloClient.ts`
- Create: `frontend/src/context/apolloProvider.tsx`
- Create: `frontend/src/shared/routes/routes.ts`
- Create: `frontend/src/shared/utils/getGraphQLErrorCode.ts`
- Create: `frontend/src/shared/ui/atoms/button.tsx` + `button.module.css`
- Create: `frontend/src/shared/ui/atoms/input.tsx` + `input.module.css`
- Create: `frontend/src/shared/ui/atoms/spinner.tsx` + `spinner.module.css`
- Create: `frontend/src/shared/ui/molecules/emptyState.tsx` + `emptyState.module.css`
- Create: `frontend/src/shared/ui/molecules/errorState.tsx` + `errorState.module.css`
- Create: `frontend/src/shared/ui/molecules/appNav.tsx` + `appNav.module.css`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/page.tsx`
- Delete: `frontend/src/app/page.module.css`

**Interfaces:**
- Produces: `routeBuilders.routes()`, `routeBuilders.routeDetail(id)`, `routeBuilders.units()` — every later `Link`/`router.push` call uses these. `getGraphQLErrorCode(error): string | undefined` — every mutation-error branch in later tasks uses this. `Button`, `Input`, `Spinner`, `EmptyState`, `ErrorState` from `@/shared/ui/...` — every organism in later tasks uses these.

- [ ] **Step 1: Apollo Client instance**

Create `frontend/src/lib/apolloClient.ts`:

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:3001/graphql',
  }),
  cache: new InMemoryCache(),
});
```

- [ ] **Step 2: Apollo provider**

Create `frontend/src/context/apolloProvider.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apolloClient';

export function AppApolloProvider({ children }: { children: ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
```

- [ ] **Step 3: Route builders**

Create `frontend/src/shared/routes/routes.ts`:

```typescript
const ROUTE_PATHS = {
  ROUTES: '/routes',
  ROUTE_DETAIL: '/routes/[id]',
  UNITS: '/units',
} as const;

export const routeBuilders = {
  routes: () => ROUTE_PATHS.ROUTES,
  routeDetail: (id: string) => `/routes/${id}`,
  units: () => ROUTE_PATHS.UNITS,
} as const;
```

- [ ] **Step 4: GraphQL error-code helper**

Create `frontend/src/shared/utils/getGraphQLErrorCode.ts`:

```typescript
import { CombinedGraphQLErrors } from '@apollo/client/errors';

export function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!CombinedGraphQLErrors.is(error)) return undefined;
  const code = error.errors[0]?.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}
```

- [ ] **Step 5: Design tokens**

Replace the contents of `frontend/src/app/globals.css` with:

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
  --color-brand-solid: #2563eb;
  --color-on-brand: #ffffff;
  --color-surface: #ffffff;
  --color-text-primary: #171717;
  --color-text-secondary: #475569;
  --color-error: #dc2626;
  --color-border: #cbd5e1;

  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;

  --radius-md: 0.375rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
    --color-surface: #0a0a0a;
    --color-text-primary: #ededed;
    --color-text-secondary: #cbd5e1;
    --color-border: #334155;
  }
}

html {
  height: 100%;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--foreground);
  background: var(--background);
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

@media (prefers-color-scheme: dark) {
  html {
    color-scheme: dark;
  }
}
```

- [ ] **Step 6: Atoms — Button**

Create `frontend/src/shared/ui/atoms/button.tsx`:

```tsx
import type { ComponentProps } from 'react';
import styles from './button.module.css';

type ButtonProps = ComponentProps<'button'>;

export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <button className={[styles.button, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  );
}
```

Create `frontend/src/shared/ui/atoms/button.module.css`:

```css
.button {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--color-brand-solid);
  color: var(--color-on-brand);
  cursor: pointer;
  font: inherit;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 7: Atoms — Input**

Create `frontend/src/shared/ui/atoms/input.tsx`:

```tsx
import type { ComponentProps } from 'react';
import styles from './input.module.css';

type InputProps = ComponentProps<'input'>;

export function Input({ className, ...props }: InputProps) {
  return <input className={[styles.input, className].filter(Boolean).join(' ')} {...props} />;
}
```

Create `frontend/src/shared/ui/atoms/input.module.css`:

```css
.input {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font: inherit;
}

.input:disabled {
  opacity: 0.6;
}
```

- [ ] **Step 8: Atoms — Spinner**

Create `frontend/src/shared/ui/atoms/spinner.tsx`:

```tsx
import styles from './spinner.module.css';

export function Spinner() {
  return <div className={styles.spinner} role="status" aria-label="Loading" />;
}
```

Create `frontend/src/shared/ui/atoms/spinner.module.css`:

```css
.spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-brand-solid);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 9: Molecules — EmptyState, ErrorState**

Create `frontend/src/shared/ui/molecules/emptyState.tsx`:

```tsx
import styles from './emptyState.module.css';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return <p className={styles.empty}>{message}</p>;
}
```

Create `frontend/src/shared/ui/molecules/emptyState.module.css`:

```css
.empty {
  color: var(--color-text-secondary);
  padding: var(--space-md);
}
```

Create `frontend/src/shared/ui/molecules/errorState.tsx`:

```tsx
import styles from './errorState.module.css';

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return <p className={styles.error}>{message}</p>;
}
```

Create `frontend/src/shared/ui/molecules/errorState.module.css`:

```css
.error {
  color: var(--color-error);
  padding: var(--space-md);
}
```

- [ ] **Step 10: Molecules — AppNav**

Create `frontend/src/shared/ui/molecules/appNav.tsx`:

```tsx
import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';
import styles from './appNav.module.css';

export function AppNav() {
  return (
    <nav className={styles.nav}>
      <Link href={routeBuilders.routes()}>Routes</Link>
      <Link href={routeBuilders.units()}>Units</Link>
    </nav>
  );
}
```

Create `frontend/src/shared/ui/molecules/appNav.module.css`:

```css
.nav {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}
```

- [ ] **Step 11: Wire the provider and nav into the root layout**

Replace the contents of `frontend/src/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppApolloProvider } from '@/context/apolloProvider';
import { AppNav } from '@/shared/ui/molecules/appNav';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Transport Planning',
  description: 'Route, unit, and duty planning',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppApolloProvider>
          <AppNav />
          {children}
        </AppApolloProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 12: Replace the home page**

Replace the contents of `frontend/src/app/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';
import { routeBuilders } from '@/shared/routes/routes';

export default function HomeRoute() {
  redirect(routeBuilders.routes());
}
```

Delete `frontend/src/app/page.module.css` (no longer imported by anything):

```bash
rm frontend/src/app/page.module.css
```

- [ ] **Step 13: Verify the build**

```bash
pnpm build
```

Expected: typecheck + build succeed (the `/routes` and `/units` pages don't exist yet, so `pnpm dev` would 404 on them, but `next build` only fails on code that doesn't compile — `redirect()` to a not-yet-existing route is valid at build time).

- [ ] **Step 14: Commit**

```bash
git add frontend/src frontend/vitest.config.ts
git commit -m "feat(frontend): Apollo Client wiring, route builders, design tokens, shared atoms/molecules"
```

---

## Task 3: Units feature — full CRUD

**Files:**
- Create: `frontend/src/features/units/domain/unit.model.ts`
- Create: `frontend/src/features/units/domain/unit.form.ts`
- Create: `frontend/src/features/units/infrastructure/units.graphql.ts`
- Create: `frontend/src/features/units/infrastructure/units.transform.ts`
- Create: `frontend/src/features/units/application/queries/useUnits.query.ts`
- Create: `frontend/src/features/units/application/mutations/useCreateUnit.mutation.ts`
- Create: `frontend/src/features/units/application/mutations/useUpdateUnit.mutation.ts`
- Create: `frontend/src/features/units/application/mutations/useDeleteUnit.mutation.ts`
- Create: `frontend/src/features/units/ui/context/unitEditContext.tsx`
- Create: `frontend/src/features/units/ui/molecules/unitFormContent.tsx` + `.module.css`
- Create: `frontend/src/features/units/ui/organisms/createUnitOrganism.tsx`
- Create: `frontend/src/features/units/ui/organisms/unitListOrganism.tsx` + `.module.css`
- Create: `frontend/src/features/units/ui/templates/unitsTemplate.tsx` + `.module.css`
- Create: `frontend/src/features/units/ui/pages/unitsPage.tsx`
- Create: `frontend/src/app/units/page.tsx`
- Test: `frontend/src/test/units/domain/unit.form.test.ts`
- Test: `frontend/src/test/units/ui/unitListOrganism.test.tsx`
- Test: `frontend/src/test/units/ui/createUnitOrganism.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Spinner`, `EmptyState`, `ErrorState` from `@/shared/ui/...` (Task 2). `routeBuilders` not needed here (no navigation out of `/units`).
- Produces: nothing consumed by other features — `units` never imports anything Route/Duty-related, and nothing in `routes` imports from `units` (the `routes` feature defines its own minimal units-for-dropdown query in Task 7, per the "no cross-feature imports" rule).

- [ ] **Step 1: Domain model**

Create `frontend/src/features/units/domain/unit.model.ts`:

```typescript
export interface Unit {
  readonly id: string;
  readonly name: string;
  readonly driverName: string;
}
```

- [ ] **Step 2: Write the failing form-schema test**

Create `frontend/src/test/units/domain/unit.form.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { unitFormDefinition } from '@/features/units/domain/unit.form';

describe('unitFormDefinition', () => {
  it('accepts a valid unit', () => {
    const result = unitFormDefinition.safeParse({ name: 'Truck 1', driverName: 'Alex' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = unitFormDefinition.safeParse({ name: '', driverName: 'Alex' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty driver name', () => {
    const result = unitFormDefinition.safeParse({ name: 'Truck 1', driverName: '' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm test -- unit.form
```

Expected: FAIL — `unit.form` module doesn't exist yet.

- [ ] **Step 4: Form schema**

Create `frontend/src/features/units/domain/unit.form.ts`:

```typescript
import { z } from 'zod';

export const unitFormDefinition = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  driverName: z.string().min(1, 'Driver name is required').max(100),
});

export type TUnitForm = z.infer<typeof unitFormDefinition>;

export function unitDefaultValues(partial?: Partial<TUnitForm>): TUnitForm {
  return {
    name: partial?.name ?? '',
    driverName: partial?.driverName ?? '',
  };
}
```

- [ ] **Step 5: Run the test again to verify it passes**

```bash
pnpm test -- unit.form
```

Expected: PASS (3 tests).

- [ ] **Step 6: GraphQL documents**

Create `frontend/src/features/units/infrastructure/units.graphql.ts`:

```typescript
import { gql } from '@apollo/client';

export const UNITS_QUERY = gql`
  query Units {
    units {
      id
      name
      driverName
    }
  }
`;

export const CREATE_UNIT_MUTATION = gql`
  mutation CreateUnit($input: CreateUnitInput!) {
    createUnit(input: $input) {
      id
      name
      driverName
    }
  }
`;

export const UPDATE_UNIT_MUTATION = gql`
  mutation UpdateUnit($id: ID!, $input: UpdateUnitInput!) {
    updateUnit(id: $id, input: $input) {
      id
      name
      driverName
    }
  }
`;

export const DELETE_UNIT_MUTATION = gql`
  mutation DeleteUnit($id: ID!) {
    deleteUnit(id: $id)
  }
`;
```

- [ ] **Step 7: Transforms**

Create `frontend/src/features/units/infrastructure/units.transform.ts`:

```typescript
import type { Unit } from '../domain/unit.model';
import type { TUnitForm } from '../domain/unit.form';

interface UnitDto {
  id: string;
  name: string;
  driverName: string;
}

export function toUnitDomain(dto: UnitDto): Unit {
  return { id: dto.id, name: dto.name, driverName: dto.driverName };
}

export function fromUnitFormInput(form: TUnitForm) {
  return { name: form.name, driverName: form.driverName };
}
```

- [ ] **Step 8: Query hook**

Create `frontend/src/features/units/application/queries/useUnits.query.ts`:

```typescript
import { useQuery } from '@apollo/client/react';
import { UNITS_QUERY } from '../../infrastructure/units.graphql';
import { toUnitDomain } from '../../infrastructure/units.transform';
import type { Unit } from '../../domain/unit.model';

interface UnitsQueryData {
  units: Array<{ id: string; name: string; driverName: string }>;
}

export function useUnits() {
  const { data, loading, error } = useQuery<UnitsQueryData>(UNITS_QUERY);
  return {
    data: data?.units.map(toUnitDomain) as Unit[] | undefined,
    loading,
    error,
  };
}
```

- [ ] **Step 9: Mutation hooks**

Create `frontend/src/features/units/application/mutations/useCreateUnit.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { CREATE_UNIT_MUTATION, UNITS_QUERY } from '../../infrastructure/units.graphql';
import { fromUnitFormInput } from '../../infrastructure/units.transform';
import type { TUnitForm } from '../../domain/unit.form';

export function useCreateUnit() {
  const [mutate, { loading, error }] = useMutation(CREATE_UNIT_MUTATION, {
    refetchQueries: [{ query: UNITS_QUERY }],
  });

  async function createUnit(form: TUnitForm) {
    return mutate({ variables: { input: fromUnitFormInput(form) } });
  }

  return { createUnit, loading, error };
}
```

Create `frontend/src/features/units/application/mutations/useUpdateUnit.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { UPDATE_UNIT_MUTATION, UNITS_QUERY } from '../../infrastructure/units.graphql';
import { fromUnitFormInput } from '../../infrastructure/units.transform';
import type { TUnitForm } from '../../domain/unit.form';

export function useUpdateUnit() {
  const [mutate, { loading, error }] = useMutation(UPDATE_UNIT_MUTATION, {
    refetchQueries: [{ query: UNITS_QUERY }],
  });

  async function updateUnit(id: string, form: TUnitForm) {
    return mutate({ variables: { id, input: fromUnitFormInput(form) } });
  }

  return { updateUnit, loading, error };
}
```

Create `frontend/src/features/units/application/mutations/useDeleteUnit.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { DELETE_UNIT_MUTATION, UNITS_QUERY } from '../../infrastructure/units.graphql';

export function useDeleteUnit() {
  const [mutate, { loading, error }] = useMutation(DELETE_UNIT_MUTATION, {
    refetchQueries: [{ query: UNITS_QUERY }],
  });

  async function deleteUnit(id: string) {
    return mutate({ variables: { id } });
  }

  return { deleteUnit, loading, error };
}
```

- [ ] **Step 10: Edit context**

Units are edited inline in the list (per the spec's `UnitListOrganism (table: name, driver, edit/delete)`), and the create form doubles as the edit form when a row's "Edit" is clicked. That's two sibling organisms sharing one piece of state — exactly what `agent_docs/frontend/layers/ui.md`'s Context pattern is for.

Create `frontend/src/features/units/ui/context/unitEditContext.tsx`:

```tsx
'use client';

import React from 'react';
import type { Unit } from '../../domain/unit.model';

interface UnitEditContextValue {
  editingUnit: Unit | null;
  startEditing: (unit: Unit) => void;
  stopEditing: () => void;
}

const UnitEditContext = React.createContext<UnitEditContextValue | null>(null);

export function UnitEditProvider({ children }: { children: React.ReactNode }) {
  const [editingUnit, setEditingUnit] = React.useState<Unit | null>(null);

  const value = React.useMemo<UnitEditContextValue>(
    () => ({
      editingUnit,
      startEditing: (unit: Unit) => setEditingUnit(unit),
      stopEditing: () => setEditingUnit(null),
    }),
    [editingUnit],
  );

  return <UnitEditContext.Provider value={value}>{children}</UnitEditContext.Provider>;
}

export function useUnitEdit(): UnitEditContextValue {
  const ctx = React.useContext(UnitEditContext);
  if (!ctx) throw new Error('useUnitEdit must be used within a UnitEditProvider');
  return ctx;
}
```

- [ ] **Step 11: Form content molecule**

Create `frontend/src/features/units/ui/molecules/unitFormContent.tsx`:

```tsx
'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TUnitForm } from '../../domain/unit.form';
import styles from './unitFormContent.module.css';

interface UnitFormContentProps {
  disabled: boolean;
  error?: string;
  submitLabel: string;
  onCancel?: () => void;
}

export function UnitFormContent({ disabled, error, submitLabel, onCancel }: UnitFormContentProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TUnitForm>();

  return (
    <div className={styles.form}>
      <Input {...register('name')} disabled={disabled} placeholder="Unit name" />
      {errors.name ? <p className={styles.error}>{errors.name.message}</p> : null}
      <Input {...register('driverName')} disabled={disabled} placeholder="Driver name" />
      {errors.driverName ? <p className={styles.error}>{errors.driverName.message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" disabled={disabled} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
```

Create `frontend/src/features/units/ui/molecules/unitFormContent.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 320px;
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
}
```

- [ ] **Step 12: Create/edit organism**

Create `frontend/src/features/units/ui/organisms/createUnitOrganism.tsx`:

```tsx
'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { unitFormDefinition, unitDefaultValues, type TUnitForm } from '../../domain/unit.form';
import { useCreateUnit } from '../../application/mutations/useCreateUnit.mutation';
import { useUpdateUnit } from '../../application/mutations/useUpdateUnit.mutation';
import { UnitFormContent } from '../molecules/unitFormContent';
import { useUnitEdit } from '../context/unitEditContext';

export function CreateUnitOrganism() {
  const { editingUnit, stopEditing } = useUnitEdit();
  const { createUnit, loading: creating, error: createError } = useCreateUnit();
  const { updateUnit, loading: updating, error: updateError } = useUpdateUnit();

  const methods = useForm<TUnitForm>({
    values: unitDefaultValues(editingUnit ?? undefined),
    resolver: zodResolver(unitFormDefinition),
  });

  const loading = creating || updating;
  const error = editingUnit ? updateError : createError;

  async function onSubmit(data: TUnitForm) {
    if (loading) return;
    if (editingUnit) {
      await updateUnit(editingUnit.id, data);
      stopEditing();
      return;
    }
    await createUnit(data);
    methods.reset(unitDefaultValues());
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <UnitFormContent
          disabled={loading}
          error={error?.message}
          submitLabel={editingUnit ? 'Save changes' : 'Create unit'}
          onCancel={editingUnit ? stopEditing : undefined}
        />
      </form>
    </FormProvider>
  );
}
```

- [ ] **Step 13: List organism**

Create `frontend/src/features/units/ui/organisms/unitListOrganism.tsx`:

```tsx
'use client';

import { useUnits } from '../../application/queries/useUnits.query';
import { useDeleteUnit } from '../../application/mutations/useDeleteUnit.mutation';
import { useUnitEdit } from '../context/unitEditContext';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { Button } from '@/shared/ui/atoms/button';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import styles from './unitListOrganism.module.css';

export function UnitListOrganism() {
  const { data, loading, error } = useUnits();
  const { deleteUnit, error: deleteError } = useDeleteUnit();
  const { editingUnit, startEditing } = useUnitEdit();

  function handleDelete(id: string) {
    if (!window.confirm('Delete this unit?')) return;
    void deleteUnit(id);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load units" />;
  if (!data?.length) return <EmptyState message="No units yet" />;

  const deleteErrorMessage =
    getGraphQLErrorCode(deleteError) === 'unitHasActiveDuties'
      ? 'This unit has duties assigned. Remove them before deleting the unit.'
      : deleteError
        ? 'Failed to delete unit. Please try again.'
        : undefined;

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Driver</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((unit) => (
            <tr key={unit.id} className={unit.id === editingUnit?.id ? styles.editing : undefined}>
              <td>{unit.name}</td>
              <td>{unit.driverName}</td>
              <td className={styles.actions}>
                <Button type="button" onClick={() => startEditing(unit)}>
                  Edit
                </Button>
                <Button type="button" onClick={() => handleDelete(unit.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteErrorMessage ? <ErrorState message={deleteErrorMessage} /> : null}
    </div>
  );
}
```

Create `frontend/src/features/units/ui/organisms/unitListOrganism.module.css`:

```css
.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-md);
}

.table th,
.table td {
  text-align: left;
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.editing {
  background: var(--color-surface);
}

.actions {
  display: flex;
  gap: var(--space-sm);
}
```

- [ ] **Step 14: Template and page**

Create `frontend/src/features/units/ui/templates/unitsTemplate.tsx`:

```tsx
import { UnitEditProvider } from '../context/unitEditContext';
import { CreateUnitOrganism } from '../organisms/createUnitOrganism';
import { UnitListOrganism } from '../organisms/unitListOrganism';
import styles from './unitsTemplate.module.css';

export function UnitsTemplate() {
  return (
    <UnitEditProvider>
      <div className={styles.layout}>
        <CreateUnitOrganism />
        <UnitListOrganism />
      </div>
    </UnitEditProvider>
  );
}
```

Create `frontend/src/features/units/ui/templates/unitsTemplate.module.css`:

```css
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
}
```

Create `frontend/src/features/units/ui/pages/unitsPage.tsx`:

```tsx
import { UnitsTemplate } from '../templates/unitsTemplate';

export function UnitsPage() {
  return <UnitsTemplate />;
}
```

Create `frontend/src/app/units/page.tsx`:

```tsx
import { UnitsPage } from '@/features/units/ui/pages/unitsPage';

export const metadata = { title: 'Units' };

export default function UnitsRoute() {
  return <UnitsPage />;
}
```

- [ ] **Step 15: Write the organism tests**

Create `frontend/src/test/units/ui/unitListOrganism.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { UNITS_QUERY } from '@/features/units/infrastructure/units.graphql';
import { UnitListOrganism } from '@/features/units/ui/organisms/unitListOrganism';
import { UnitEditProvider } from '@/features/units/ui/context/unitEditContext';

describe('UnitListOrganism', () => {
  it('renders units once loaded', async () => {
    const mocks = [
      {
        request: { query: UNITS_QUERY },
        result: { data: { units: [{ id: '1', name: 'Truck 1', driverName: 'Alex' }] } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <UnitEditProvider>
          <UnitListOrganism />
        </UnitEditProvider>
      </MockedProvider>,
    );
    expect(await screen.findByText('Truck 1')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('shows an empty state when there are no units', async () => {
    const mocks = [{ request: { query: UNITS_QUERY }, result: { data: { units: [] } } }];
    render(
      <MockedProvider mocks={mocks}>
        <UnitEditProvider>
          <UnitListOrganism />
        </UnitEditProvider>
      </MockedProvider>,
    );
    expect(await screen.findByText('No units yet')).toBeInTheDocument();
  });
});
```

Create `frontend/src/test/units/ui/createUnitOrganism.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import { CREATE_UNIT_MUTATION, UNITS_QUERY } from '@/features/units/infrastructure/units.graphql';
import { CreateUnitOrganism } from '@/features/units/ui/organisms/createUnitOrganism';
import { UnitEditProvider } from '@/features/units/ui/context/unitEditContext';

describe('CreateUnitOrganism', () => {
  it('submits the entered values as the mutation input', async () => {
    const user = userEvent.setup();
    const mocks = [
      {
        request: {
          query: CREATE_UNIT_MUTATION,
          variables: { input: { name: 'Truck 1', driverName: 'Alex' } },
        },
        result: { data: { createUnit: { id: '1', name: 'Truck 1', driverName: 'Alex' } } },
      },
      { request: { query: UNITS_QUERY }, result: { data: { units: [] } } },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <UnitEditProvider>
          <CreateUnitOrganism />
        </UnitEditProvider>
      </MockedProvider>,
    );

    await user.type(screen.getByPlaceholderText('Unit name'), 'Truck 1');
    await user.type(screen.getByPlaceholderText('Driver name'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Create unit' }));

    expect(await screen.findByRole('button', { name: 'Create unit' })).toBeEnabled();
  });
});
```

- [ ] **Step 16: Run the tests**

```bash
pnpm test
```

Expected: all Units tests PASS (no console errors about unmatched MockedProvider requests).

- [ ] **Step 17: Build and lint**

```bash
pnpm build
pnpm lint
```

- [ ] **Step 18: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): units feature — list, create, inline edit, delete"
```

---

## Task 4: Routes feature — list + create (no detail page yet)

**Files:**
- Create: `frontend/src/features/routes/domain/route.model.ts`
- Create: `frontend/src/features/routes/domain/route.form.ts`
- Create: `frontend/src/features/routes/infrastructure/routes.graphql.ts`
- Create: `frontend/src/features/routes/infrastructure/routes.transform.ts`
- Create: `frontend/src/features/routes/application/queries/useRoutes.query.ts`
- Create: `frontend/src/features/routes/application/queries/useRoute.query.ts`
- Create: `frontend/src/features/routes/application/mutations/useCreateRoute.mutation.ts`
- Create: `frontend/src/features/routes/ui/molecules/routeCard.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/molecules/routeFormContent.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/organisms/routeListOrganism.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/organisms/createRouteOrganism.tsx`
- Create: `frontend/src/features/routes/ui/templates/routesTemplate.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/pages/routesPage.tsx`
- Create: `frontend/src/app/routes/page.tsx`
- Test: `frontend/src/test/routes/domain/route.form.test.ts`
- Test: `frontend/src/test/routes/ui/routeListOrganism.test.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Spinner`, `EmptyState`, `ErrorState` (Task 2), `routeBuilders.routeDetail(id)` (Task 2).
- Produces: `useRoute(id)` (Task 5+ organisms — Map, Edit — consume this same hook; Apollo's cache normalizes by id so multiple organisms calling it concurrently share one network request). `ROUTES_QUERY` (Task 7's duty mutations refetch it so route cards' duty counts stay live).

- [ ] **Step 1: Domain model**

Create `frontend/src/features/routes/domain/route.model.ts`:

```typescript
export interface RoutePoint {
  readonly lat: number;
  readonly lng: number;
  readonly name: string | null;
}

export interface Route {
  readonly id: string;
  readonly name: string | null;
  readonly points: readonly RoutePoint[];
}

export interface RouteSummary {
  readonly id: string;
  readonly name: string | null;
  readonly pointCount: number;
  readonly dutyCount: number;
}
```

- [ ] **Step 2: Write the failing form-schema test**

Create `frontend/src/test/routes/domain/route.form.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { routeFormDefinition } from '@/features/routes/domain/route.form';

describe('routeFormDefinition', () => {
  it('accepts a route with at least one valid point', () => {
    const result = routeFormDefinition.safeParse({
      name: 'Downtown loop',
      points: [{ lat: 10, lng: 20, name: 'Start' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a route with no points', () => {
    const result = routeFormDefinition.safeParse({ name: 'Empty', points: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range latitude', () => {
    const result = routeFormDefinition.safeParse({ points: [{ lat: 200, lng: 20 }] });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm test -- route.form
```

Expected: FAIL — module doesn't exist yet.

- [ ] **Step 4: Form schema**

Create `frontend/src/features/routes/domain/route.form.ts`:

```typescript
import { z } from 'zod';

export const routePointFormDefinition = z.object({
  lat: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  name: z.string().optional(),
});

export const routeFormDefinition = z.object({
  name: z.string().optional(),
  points: z.array(routePointFormDefinition).min(1, 'At least one point is required'),
});

export type TRouteForm = z.infer<typeof routeFormDefinition>;

export function routeDefaultValues(partial?: Partial<TRouteForm>): TRouteForm {
  return {
    name: partial?.name ?? '',
    points: partial?.points ?? [{ lat: 0, lng: 0, name: '' }],
  };
}
```

- [ ] **Step 5: Run the test again to verify it passes**

```bash
pnpm test -- route.form
```

Expected: PASS (3 tests).

- [ ] **Step 6: GraphQL documents**

Create `frontend/src/features/routes/infrastructure/routes.graphql.ts`:

```typescript
import { gql } from '@apollo/client';

export const ROUTES_QUERY = gql`
  query Routes {
    routes {
      id
      name
      points {
        lat
        lng
        name
      }
      duties {
        id
      }
    }
  }
`;

export const ROUTE_QUERY = gql`
  query Route($id: ID!) {
    route(id: $id) {
      id
      name
      points {
        lat
        lng
        name
      }
    }
  }
`;

export const CREATE_ROUTE_MUTATION = gql`
  mutation CreateRoute($input: CreateRouteInput!) {
    createRoute(input: $input) {
      id
    }
  }
`;

export const UPDATE_ROUTE_MUTATION = gql`
  mutation UpdateRoute($id: ID!, $input: UpdateRouteInput!) {
    updateRoute(id: $id, input: $input) {
      id
      name
      points {
        lat
        lng
        name
      }
    }
  }
`;

export const DELETE_ROUTE_MUTATION = gql`
  mutation DeleteRoute($id: ID!) {
    deleteRoute(id: $id)
  }
`;
```

(`UPDATE_ROUTE_MUTATION` and `DELETE_ROUTE_MUTATION` are defined now so Task 5 doesn't need to touch this file again.)

- [ ] **Step 7: Transforms**

Create `frontend/src/features/routes/infrastructure/routes.transform.ts`:

```typescript
import type { Route, RouteSummary } from '../domain/route.model';
import type { TRouteForm } from '../domain/route.form';

interface RoutePointDto {
  lat: number;
  lng: number;
  name: string | null;
}

interface RouteDto {
  id: string;
  name: string | null;
  points: RoutePointDto[];
}

interface RouteSummaryDto extends RouteDto {
  duties: Array<{ id: string }>;
}

export function toRouteDomain(dto: RouteDto): Route {
  return {
    id: dto.id,
    name: dto.name,
    points: dto.points.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name })),
  };
}

export function toRouteSummaryDomain(dto: RouteSummaryDto): RouteSummary {
  return {
    id: dto.id,
    name: dto.name,
    pointCount: dto.points.length,
    dutyCount: dto.duties.length,
  };
}

export function fromRouteFormInput(form: TRouteForm) {
  return {
    name: form.name?.trim() ? form.name.trim() : undefined,
    points: form.points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name?.trim() ? p.name.trim() : undefined,
    })),
  };
}
```

- [ ] **Step 8: Query hooks**

Create `frontend/src/features/routes/application/queries/useRoutes.query.ts`:

```typescript
import { useQuery } from '@apollo/client/react';
import { ROUTES_QUERY } from '../../infrastructure/routes.graphql';
import { toRouteSummaryDomain } from '../../infrastructure/routes.transform';
import type { RouteSummary } from '../../domain/route.model';

interface RoutesQueryData {
  routes: Array<{
    id: string;
    name: string | null;
    points: Array<{ lat: number; lng: number; name: string | null }>;
    duties: Array<{ id: string }>;
  }>;
}

export function useRoutes() {
  const { data, loading, error } = useQuery<RoutesQueryData>(ROUTES_QUERY);
  return {
    data: data?.routes.map(toRouteSummaryDomain) as RouteSummary[] | undefined,
    loading,
    error,
  };
}
```

Create `frontend/src/features/routes/application/queries/useRoute.query.ts`:

```typescript
import { useQuery } from '@apollo/client/react';
import { ROUTE_QUERY } from '../../infrastructure/routes.graphql';
import { toRouteDomain } from '../../infrastructure/routes.transform';
import type { Route } from '../../domain/route.model';

interface RouteQueryData {
  route: {
    id: string;
    name: string | null;
    points: Array<{ lat: number; lng: number; name: string | null }>;
  } | null;
}

export function useRoute(id: string) {
  const { data, loading, error } = useQuery<RouteQueryData>(ROUTE_QUERY, {
    variables: { id },
  });
  return {
    data: data ? ((data.route ? toRouteDomain(data.route) : null) as Route | null) : undefined,
    loading,
    error,
  };
}
```

(`data` is `undefined` while no response has arrived yet, `null` once the server has confirmed the route doesn't exist, and a `Route` once found — three distinct states an organism can render differently.)

- [ ] **Step 9: Create mutation hook**

Create `frontend/src/features/routes/application/mutations/useCreateRoute.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { CREATE_ROUTE_MUTATION, ROUTES_QUERY } from '../../infrastructure/routes.graphql';
import { fromRouteFormInput } from '../../infrastructure/routes.transform';
import type { TRouteForm } from '../../domain/route.form';

export function useCreateRoute() {
  const [mutate, { loading, error }] = useMutation(CREATE_ROUTE_MUTATION, {
    refetchQueries: [{ query: ROUTES_QUERY }],
  });

  async function createRoute(form: TRouteForm) {
    return mutate({ variables: { input: fromRouteFormInput(form) } });
  }

  return { createRoute, loading, error };
}
```

- [ ] **Step 10: Route card molecule**

Create `frontend/src/features/routes/ui/molecules/routeCard.tsx`:

```tsx
import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';
import type { RouteSummary } from '../../domain/route.model';
import styles from './routeCard.module.css';

interface RouteCardProps {
  route: RouteSummary;
}

export function RouteCard({ route }: RouteCardProps) {
  return (
    <Link href={routeBuilders.routeDetail(route.id)} className={styles.card}>
      <span className={styles.name}>{route.name ?? 'Unnamed route'}</span>
      <span className={styles.meta}>
        {route.pointCount} points · {route.dutyCount} duties
      </span>
    </Link>
  );
}
```

Create `frontend/src/features/routes/ui/molecules/routeCard.module.css`:

```css
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: inherit;
}

.name {
  font-weight: 600;
}

.meta {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}
```

- [ ] **Step 11: Route form content molecule (shared by Create and Edit)**

Create `frontend/src/features/routes/ui/molecules/routeFormContent.tsx`:

```tsx
'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TRouteForm } from '../../domain/route.form';
import styles from './routeFormContent.module.css';

interface RouteFormContentProps {
  disabled: boolean;
  error?: string;
  submitLabel: string;
}

export function RouteFormContent({ disabled, error, submitLabel }: RouteFormContentProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TRouteForm>();
  const { fields, append, remove } = useFieldArray({ control, name: 'points' });

  return (
    <div className={styles.form}>
      <Input {...register('name')} disabled={disabled} placeholder="Route name (optional)" />
      <div className={styles.points}>
        {fields.map((field, index) => (
          <div key={field.id} className={styles.pointRow}>
            <Input
              {...register(`points.${index}.lat`, { valueAsNumber: true })}
              disabled={disabled}
              type="number"
              step="any"
              placeholder="Latitude"
            />
            <Input
              {...register(`points.${index}.lng`, { valueAsNumber: true })}
              disabled={disabled}
              type="number"
              step="any"
              placeholder="Longitude"
            />
            <Input {...register(`points.${index}.name`)} disabled={disabled} placeholder="Point name (optional)" />
            <Button type="button" disabled={disabled || fields.length === 1} onClick={() => remove(index)}>
              Remove
            </Button>
          </div>
        ))}
      </div>
      {errors.points?.message ? <p className={styles.error}>{errors.points.message}</p> : null}
      <Button type="button" disabled={disabled} onClick={() => append({ lat: 0, lng: 0, name: '' })}>
        Add point
      </Button>
      {error ? <p className={styles.error}>{error}</p> : null}
      <Button type="submit" disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/molecules/routeFormContent.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 480px;
}

.points {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.pointRow {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: var(--space-sm);
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
}
```

- [ ] **Step 12: List organism**

Create `frontend/src/features/routes/ui/organisms/routeListOrganism.tsx`:

```tsx
'use client';

import { useRoutes } from '../../application/queries/useRoutes.query';
import { RouteCard } from '../molecules/routeCard';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import styles from './routeListOrganism.module.css';

export function RouteListOrganism() {
  const { data, loading, error } = useRoutes();

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load routes" />;
  if (!data?.length) return <EmptyState message="No routes yet" />;

  return (
    <div className={styles.list}>
      {data.map((route) => (
        <RouteCard key={route.id} route={route} />
      ))}
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/organisms/routeListOrganism.module.css`:

```css
.list {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

@media (min-width: 768px) {
  .list {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 13: Create organism**

Create `frontend/src/features/routes/ui/organisms/createRouteOrganism.tsx`:

```tsx
'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { routeFormDefinition, routeDefaultValues, type TRouteForm } from '../../domain/route.form';
import { useCreateRoute } from '../../application/mutations/useCreateRoute.mutation';
import { RouteFormContent } from '../molecules/routeFormContent';
import { routeBuilders } from '@/shared/routes/routes';

export function CreateRouteOrganism() {
  const router = useRouter();
  const { createRoute, loading, error } = useCreateRoute();

  const methods = useForm<TRouteForm>({
    defaultValues: routeDefaultValues(),
    resolver: zodResolver(routeFormDefinition),
  });

  async function onSubmit(data: TRouteForm) {
    if (loading) return;
    const result = await createRoute(data);
    const id = result.data?.createRoute?.id;
    if (id) router.push(routeBuilders.routeDetail(id));
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <RouteFormContent disabled={loading} error={error?.message} submitLabel="Create route" />
      </form>
    </FormProvider>
  );
}
```

- [ ] **Step 14: Template and page**

Create `frontend/src/features/routes/ui/templates/routesTemplate.tsx`:

```tsx
import { CreateRouteOrganism } from '../organisms/createRouteOrganism';
import { RouteListOrganism } from '../organisms/routeListOrganism';
import styles from './routesTemplate.module.css';

export function RoutesTemplate() {
  return (
    <div className={styles.layout}>
      <CreateRouteOrganism />
      <RouteListOrganism />
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/templates/routesTemplate.module.css`:

```css
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
}
```

Create `frontend/src/features/routes/ui/pages/routesPage.tsx`:

```tsx
import { RoutesTemplate } from '../templates/routesTemplate';

export function RoutesPage() {
  return <RoutesTemplate />;
}
```

Create `frontend/src/app/routes/page.tsx`:

```tsx
import { RoutesPage } from '@/features/routes/ui/pages/routesPage';

export const metadata = { title: 'Routes' };

export default function RoutesRoute() {
  return <RoutesPage />;
}
```

- [ ] **Step 15: Write the list organism test**

Create `frontend/src/test/routes/ui/routeListOrganism.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { ROUTES_QUERY } from '@/features/routes/infrastructure/routes.graphql';
import { RouteListOrganism } from '@/features/routes/ui/organisms/routeListOrganism';

describe('RouteListOrganism', () => {
  it('renders a card per route with point and duty counts', async () => {
    const mocks = [
      {
        request: { query: ROUTES_QUERY },
        result: {
          data: {
            routes: [
              { id: '1', name: 'Downtown loop', points: [{ lat: 1, lng: 2, name: null }], duties: [] },
            ],
          },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteListOrganism />
      </MockedProvider>,
    );
    expect(await screen.findByText('Downtown loop')).toBeInTheDocument();
    expect(screen.getByText('1 points · 0 duties')).toBeInTheDocument();
  });

  it('shows an empty state when there are no routes', async () => {
    const mocks = [{ request: { query: ROUTES_QUERY }, result: { data: { routes: [] } } }];
    render(
      <MockedProvider mocks={mocks}>
        <RouteListOrganism />
      </MockedProvider>,
    );
    expect(await screen.findByText('No routes yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 16: Run the tests, build, lint**

```bash
pnpm test
pnpm build
pnpm lint
```

- [ ] **Step 17: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): routes feature — list and create"
```

---

## Task 5: Routes feature — detail page shell, edit, delete

**Files:**
- Create: `frontend/src/features/routes/application/mutations/useUpdateRoute.mutation.ts`
- Create: `frontend/src/features/routes/application/mutations/useDeleteRoute.mutation.ts`
- Create: `frontend/src/features/routes/ui/organisms/editRouteOrganism.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/templates/routeDetailTemplate.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/pages/routeDetailPage.tsx`
- Create: `frontend/src/app/routes/[id]/page.tsx`
- Test: `frontend/src/test/routes/ui/editRouteOrganism.test.tsx`

**Interfaces:**
- Consumes: `useRoute(id)` (Task 4), `ROUTE_QUERY`/`UPDATE_ROUTE_MUTATION`/`DELETE_ROUTE_MUTATION`/`ROUTES_QUERY` (Task 4), `RouteFormContent` (Task 4), `getGraphQLErrorCode` (Task 2).
- Produces: `RouteDetailTemplate({ routeId })` — Task 6 modifies this file to add `RouteMapOrganism`, Task 7 modifies it again to add `RouteDutiesOrganism`.

- [ ] **Step 1: Update mutation hook**

Create `frontend/src/features/routes/application/mutations/useUpdateRoute.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { UPDATE_ROUTE_MUTATION, ROUTES_QUERY, ROUTE_QUERY } from '../../infrastructure/routes.graphql';
import { fromRouteFormInput } from '../../infrastructure/routes.transform';
import type { TRouteForm } from '../../domain/route.form';

export function useUpdateRoute() {
  const [mutate, { loading, error }] = useMutation(UPDATE_ROUTE_MUTATION);

  async function updateRoute(id: string, form: TRouteForm) {
    return mutate({
      variables: { id, input: fromRouteFormInput(form) },
      refetchQueries: [{ query: ROUTE_QUERY, variables: { id } }, { query: ROUTES_QUERY }],
    });
  }

  return { updateRoute, loading, error };
}
```

- [ ] **Step 2: Delete mutation hook**

Create `frontend/src/features/routes/application/mutations/useDeleteRoute.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { DELETE_ROUTE_MUTATION, ROUTES_QUERY } from '../../infrastructure/routes.graphql';

export function useDeleteRoute() {
  const [mutate, { loading, error }] = useMutation(DELETE_ROUTE_MUTATION, {
    refetchQueries: [{ query: ROUTES_QUERY }],
  });

  async function deleteRoute(id: string) {
    return mutate({ variables: { id } });
  }

  return { deleteRoute, loading, error };
}
```

- [ ] **Step 3: Edit organism**

Create `frontend/src/features/routes/ui/organisms/editRouteOrganism.tsx`:

```tsx
'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { routeFormDefinition, routeDefaultValues, type TRouteForm } from '../../domain/route.form';
import { useRoute } from '../../application/queries/useRoute.query';
import { useUpdateRoute } from '../../application/mutations/useUpdateRoute.mutation';
import { useDeleteRoute } from '../../application/mutations/useDeleteRoute.mutation';
import { RouteFormContent } from '../molecules/routeFormContent';
import { Button } from '@/shared/ui/atoms/button';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import { routeBuilders } from '@/shared/routes/routes';
import styles from './editRouteOrganism.module.css';

interface EditRouteOrganismProps {
  routeId: string;
}

export function EditRouteOrganism({ routeId }: EditRouteOrganismProps) {
  const router = useRouter();
  const { data: route, loading, error } = useRoute(routeId);
  const { updateRoute, loading: updating, error: updateError } = useUpdateRoute();
  const { deleteRoute, loading: deleting, error: deleteError } = useDeleteRoute();

  const methods = useForm<TRouteForm>({
    values: route ? routeDefaultValues(route) : undefined,
    resolver: zodResolver(routeFormDefinition),
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load this route" />;
  if (!route) return <ErrorState message="Route not found" />;

  async function onSubmit(data: TRouteForm) {
    if (updating) return;
    await updateRoute(routeId, data);
  }

  function handleDelete() {
    if (deleting) return;
    if (!window.confirm('Delete this route?')) return;
    void deleteRoute(routeId).then(() => router.push(routeBuilders.routes()));
  }

  const deleteErrorMessage =
    getGraphQLErrorCode(deleteError) === 'routeHasActiveDuties'
      ? 'This route has duties assigned. Remove them before deleting the route.'
      : deleteError
        ? 'Failed to delete route. Please try again.'
        : undefined;

  return (
    <div>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <RouteFormContent disabled={updating} error={updateError?.message} submitLabel="Save changes" />
        </form>
      </FormProvider>
      <Button type="button" disabled={deleting} onClick={handleDelete} className={styles.deleteButton}>
        Delete route
      </Button>
      {deleteErrorMessage ? <ErrorState message={deleteErrorMessage} /> : null}
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/organisms/editRouteOrganism.module.css`:

```css
.deleteButton {
  margin-top: var(--space-md);
  background: var(--color-error);
}
```

- [ ] **Step 4: Detail template**

Create `frontend/src/features/routes/ui/templates/routeDetailTemplate.tsx`:

```tsx
import { EditRouteOrganism } from '../organisms/editRouteOrganism';
import styles from './routeDetailTemplate.module.css';

interface RouteDetailTemplateProps {
  routeId: string;
}

export function RouteDetailTemplate({ routeId }: RouteDetailTemplateProps) {
  return (
    <div className={styles.layout}>
      <EditRouteOrganism routeId={routeId} />
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/templates/routeDetailTemplate.module.css`:

```css
.layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
}
```

- [ ] **Step 5: Detail page and route file**

Create `frontend/src/features/routes/ui/pages/routeDetailPage.tsx`:

```tsx
import { RouteDetailTemplate } from '../templates/routeDetailTemplate';

interface RouteDetailPageProps {
  routeId: string;
}

export function RouteDetailPage({ routeId }: RouteDetailPageProps) {
  return <RouteDetailTemplate routeId={routeId} />;
}
```

Create `frontend/src/app/routes/[id]/page.tsx`:

```tsx
import { RouteDetailPage } from '@/features/routes/ui/pages/routeDetailPage';

export const metadata = { title: 'Route detail' };

export default async function RouteDetailRoute({ params }: PageProps<'/routes/[id]'>) {
  const { id } = await params;
  return <RouteDetailPage routeId={id} />;
}
```

- [ ] **Step 6: Write the edit organism test**

Create `frontend/src/test/routes/ui/editRouteOrganism.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { ROUTE_QUERY } from '@/features/routes/infrastructure/routes.graphql';
import { EditRouteOrganism } from '@/features/routes/ui/organisms/editRouteOrganism';

describe('EditRouteOrganism', () => {
  it('shows "Route not found" when the route does not exist', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: 'missing' } },
        result: { data: { route: null } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <EditRouteOrganism routeId="missing" />
      </MockedProvider>,
    );
    expect(await screen.findByText('Route not found')).toBeInTheDocument();
  });

  it('pre-fills the form with the existing route once loaded', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: '1' } },
        result: {
          data: { route: { id: '1', name: 'Downtown loop', points: [{ lat: 1, lng: 2, name: 'Start' }] } },
        },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <EditRouteOrganism routeId="1" />
      </MockedProvider>,
    );
    expect(await screen.findByDisplayValue('Downtown loop')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the tests, build, lint**

```bash
pnpm test
pnpm build
pnpm lint
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): route detail page — edit and delete"
```

---

## Task 6: Route detail — map (Leaflet + OpenStreetMap)

**Files:**
- Create: `frontend/src/features/routes/ui/organisms/routeMapOrganism.tsx`
- Create: `frontend/src/features/routes/ui/organisms/routeLeafletMap.tsx` + `.module.css`
- Modify: `frontend/src/features/routes/ui/templates/routeDetailTemplate.tsx`
- Test: `frontend/src/test/routes/ui/routeMapOrganism.test.tsx`

**Interfaces:**
- Consumes: `useRoute(id)` (Task 4).

- [ ] **Step 1: Leaflet map internals (client-only)**

Create `frontend/src/features/routes/ui/organisms/routeLeafletMap.tsx`:

```tsx
'use client';

import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RoutePoint } from '../../domain/route.model';
import styles from './routeLeafletMap.module.css';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface RouteLeafletMapProps {
  points: readonly RoutePoint[];
}

export function RouteLeafletMap({ points }: RouteLeafletMapProps) {
  const positions = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer center={positions[0]} zoom={13} className={styles.map}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Polyline positions={positions} />
      {points.map((point, index) => (
        <Marker key={index} position={[point.lat, point.lng]} icon={markerIcon}>
          <Popup>{point.name ?? `Point ${index + 1}`}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

Marker icon assets are loaded from the `unpkg` CDN rather than bundled — Leaflet's default icon paths assume a specific static-asset layout that doesn't survive most bundlers (Turbopack included) without extra config; pointing at the CDN sidesteps that entirely and is the standard workaround.

Create `frontend/src/features/routes/ui/organisms/routeLeafletMap.module.css`:

```css
.map {
  width: 100%;
  height: 400px;
  border-radius: var(--radius-md);
}
```

- [ ] **Step 2: Organism wrapper (owns data + SSR-disabled dynamic import)**

Leaflet touches `window` at import time, which breaks server rendering. `RouteMapOrganism` owns the data fetch and loading/error/empty states (per the organism pattern); the actual Leaflet component is loaded client-only via `next/dynamic`.

Create `frontend/src/features/routes/ui/organisms/routeMapOrganism.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useRoute } from '../../application/queries/useRoute.query';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';

const RouteLeafletMap = dynamic(
  () => import('./routeLeafletMap').then((mod) => mod.RouteLeafletMap),
  { ssr: false },
);

interface RouteMapOrganismProps {
  routeId: string;
}

export function RouteMapOrganism({ routeId }: RouteMapOrganismProps) {
  const { data: route, loading, error } = useRoute(routeId);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load the map" />;
  if (!route) return <ErrorState message="Route not found" />;
  if (!route.points.length) return <EmptyState message="This route has no points yet" />;

  return <RouteLeafletMap points={route.points} />;
}
```

- [ ] **Step 3: Wire into the detail template**

Edit `frontend/src/features/routes/ui/templates/routeDetailTemplate.tsx` — add the import and render it above `EditRouteOrganism`:

```tsx
import { RouteMapOrganism } from '../organisms/routeMapOrganism';
import { EditRouteOrganism } from '../organisms/editRouteOrganism';
import styles from './routeDetailTemplate.module.css';

interface RouteDetailTemplateProps {
  routeId: string;
}

export function RouteDetailTemplate({ routeId }: RouteDetailTemplateProps) {
  return (
    <div className={styles.layout}>
      <RouteMapOrganism routeId={routeId} />
      <EditRouteOrganism routeId={routeId} />
    </div>
  );
}
```

- [ ] **Step 4: Write the map organism test**

Real Leaflet DOM initialization needs real layout measurements jsdom doesn't provide, so this test mocks `react-leaflet` itself — treating the map library as an external boundary is the same "mock at boundaries" principle `agent_docs/frontend/testing.md` applies to Apollo, just for a different dependency. The test proves `RouteMapOrganism`'s own responsibility (loading/error/empty state selection from the route query), not Leaflet's rendering.

Create `frontend/src/test/routes/ui/routeMapOrganism.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing/react';
import { ROUTE_QUERY } from '@/features/routes/infrastructure/routes.graphql';
import { RouteMapOrganism } from '@/features/routes/ui/organisms/routeMapOrganism';

vi.mock('../../../features/routes/ui/organisms/routeLeafletMap', () => ({
  RouteLeafletMap: () => <div data-testid="leaflet-map" />,
}));

describe('RouteMapOrganism', () => {
  it('shows an empty state when the route has no points', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: '1' } },
        result: { data: { route: { id: '1', name: 'Empty route', points: [] } } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteMapOrganism routeId="1" />
      </MockedProvider>,
    );
    expect(await screen.findByText('This route has no points yet')).toBeInTheDocument();
  });

  it('shows "Route not found" when the route does not exist', async () => {
    const mocks = [
      {
        request: { query: ROUTE_QUERY, variables: { id: 'missing' } },
        result: { data: { route: null } },
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <RouteMapOrganism routeId="missing" />
      </MockedProvider>,
    );
    expect(await screen.findByText('Route not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the tests, build, lint**

```bash
pnpm test
pnpm build
pnpm lint
```

- [ ] **Step 6: Manually verify the map renders**

With the backend running (`cd backend && pnpm start:dev`) and MongoDB up, run `pnpm dev` in `frontend/`, create a route with 2+ points via `/routes`, and open its detail page — confirm the map renders tiles, a marker per point, and a connecting polyline.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): route detail map (Leaflet + OpenStreetMap)"
```

---

## Task 7: Route detail — duty scheduling (the overlap-error requirement)

This is the task the spec calls out explicitly: *"A `DutyOverlapError` from the backend surfaces as an inline form error... not a generic toast; it's the rule the whole exercise is about, so it deserves visible, specific feedback."*

**Files:**
- Create: `frontend/src/features/routes/domain/duty.model.ts`
- Create: `frontend/src/features/routes/domain/duty.logic.ts`
- Create: `frontend/src/features/routes/domain/duty.form.ts`
- Create: `frontend/src/features/routes/infrastructure/duties.graphql.ts`
- Create: `frontend/src/features/routes/infrastructure/duties.transform.ts`
- Create: `frontend/src/features/routes/application/queries/useRouteDuties.query.ts`
- Create: `frontend/src/features/routes/application/queries/useUnitsForDutyForm.query.ts`
- Create: `frontend/src/features/routes/application/mutations/useCreateDuty.mutation.ts`
- Create: `frontend/src/features/routes/application/mutations/useUpdateDuty.mutation.ts`
- Create: `frontend/src/features/routes/application/mutations/useDeleteDuty.mutation.ts`
- Create: `frontend/src/features/routes/ui/molecules/dutyRow.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/molecules/dutyFormContent.tsx` + `.module.css`
- Create: `frontend/src/features/routes/ui/organisms/routeDutiesOrganism.tsx` + `.module.css`
- Modify: `frontend/src/features/routes/ui/templates/routeDetailTemplate.tsx`
- Test: `frontend/src/test/routes/domain/duty.form.test.ts`
- Test: `frontend/src/test/routes/ui/routeDutiesOrganism.test.tsx`

**Interfaces:**
- Consumes: `ROUTES_QUERY` (Task 4, refetched so route cards' duty counts stay live).
- Note: defines its own minimal units query (`UNITS_FOR_DUTY_FORM_QUERY`) rather than importing anything from the `units` feature — cross-feature imports are forbidden (`agent_docs/frontend/import-boundaries.md`); the query is 4 lines and not worth promoting to `shared/` for a single second consumer.

- [ ] **Step 1: Domain model**

Create `frontend/src/features/routes/domain/duty.model.ts`:

```typescript
export interface DutyUnit {
  readonly id: string;
  readonly name: string;
  readonly driverName: string;
}

export interface Duty {
  readonly id: string;
  readonly unitId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  // Embeds the resolved unit, not just its id: every place this UI renders a
  // duty also needs the unit's name/driver, and the backend's `duty.unit`
  // resolved field already joins it server-side — re-deriving it from a
  // second Unit fetch would be pure duplication for no benefit.
  readonly unit: DutyUnit;
}
```

- [ ] **Step 2: Datetime-local helpers**

Create `frontend/src/features/routes/domain/duty.logic.ts`:

```typescript
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): Date {
  return new Date(value);
}
```

- [ ] **Step 3: Write the failing form-schema test**

Create `frontend/src/test/routes/domain/duty.form.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { dutyFormDefinition } from '@/features/routes/domain/duty.form';

describe('dutyFormDefinition', () => {
  it('accepts a window where endsAt is after startsAt', () => {
    const result = dutyFormDefinition.safeParse({
      unitId: '1',
      startsAt: '2026-09-01T08:00',
      endsAt: '2026-09-01T09:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a window where endsAt is not after startsAt', () => {
    const result = dutyFormDefinition.safeParse({
      unitId: '1',
      startsAt: '2026-09-01T09:00',
      endsAt: '2026-09-01T09:00',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

```bash
pnpm test -- duty.form
```

Expected: FAIL — module doesn't exist yet.

- [ ] **Step 5: Form schema**

Create `frontend/src/features/routes/domain/duty.form.ts`:

```typescript
import { z } from 'zod';

export const dutyFormDefinition = z
  .object({
    unitId: z.string().min(1, 'Unit is required'),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endsAt) <= new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endsAt'],
      });
    }
  });

export type TDutyForm = z.infer<typeof dutyFormDefinition>;

export function dutyDefaultValues(partial?: { unitId?: string; startsAt?: string; endsAt?: string }): TDutyForm {
  return {
    unitId: partial?.unitId ?? '',
    startsAt: partial?.startsAt ?? '',
    endsAt: partial?.endsAt ?? '',
  };
}
```

- [ ] **Step 6: Run the test again to verify it passes**

```bash
pnpm test -- duty.form
```

Expected: PASS (2 tests).

- [ ] **Step 7: GraphQL documents**

Create `frontend/src/features/routes/infrastructure/duties.graphql.ts`:

```typescript
import { gql } from '@apollo/client';

export const ROUTE_DUTIES_QUERY = gql`
  query RouteDuties($routeId: ID!) {
    route(id: $routeId) {
      id
      duties {
        id
        unitId
        startsAt
        endsAt
        unit {
          id
          name
          driverName
        }
      }
    }
  }
`;

export const UNITS_FOR_DUTY_FORM_QUERY = gql`
  query UnitsForDutyForm {
    units {
      id
      name
      driverName
    }
  }
`;

export const CREATE_DUTY_MUTATION = gql`
  mutation CreateDuty($input: CreateDutyInput!) {
    createDuty(input: $input) {
      id
    }
  }
`;

export const UPDATE_DUTY_MUTATION = gql`
  mutation UpdateDuty($id: ID!, $input: UpdateDutyInput!) {
    updateDuty(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_DUTY_MUTATION = gql`
  mutation DeleteDuty($id: ID!) {
    deleteDuty(id: $id)
  }
`;
```

- [ ] **Step 8: Transforms**

Create `frontend/src/features/routes/infrastructure/duties.transform.ts`:

```typescript
import type { Duty } from '../domain/duty.model';
import type { TDutyForm } from '../domain/duty.form';
import { fromDatetimeLocalValue } from '../domain/duty.logic';

interface DutyDto {
  id: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  unit: { id: string; name: string; driverName: string };
}

export function toDutyDomain(dto: DutyDto): Duty {
  return {
    id: dto.id,
    unitId: dto.unitId,
    startsAt: new Date(dto.startsAt),
    endsAt: new Date(dto.endsAt),
    unit: dto.unit,
  };
}

export function fromCreateDutyInput(routeId: string, form: TDutyForm) {
  return {
    routeId,
    unitId: form.unitId,
    startsAt: fromDatetimeLocalValue(form.startsAt).toISOString(),
    endsAt: fromDatetimeLocalValue(form.endsAt).toISOString(),
  };
}

export function fromUpdateDutyInput(form: TDutyForm) {
  return {
    unitId: form.unitId,
    startsAt: fromDatetimeLocalValue(form.startsAt).toISOString(),
    endsAt: fromDatetimeLocalValue(form.endsAt).toISOString(),
  };
}
```

- [ ] **Step 9: Query hooks**

Create `frontend/src/features/routes/application/queries/useRouteDuties.query.ts`:

```typescript
import { useQuery } from '@apollo/client/react';
import { ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { toDutyDomain } from '../../infrastructure/duties.transform';
import type { Duty } from '../../domain/duty.model';

interface RouteDutiesQueryData {
  route: {
    id: string;
    duties: Array<{
      id: string;
      unitId: string;
      startsAt: string;
      endsAt: string;
      unit: { id: string; name: string; driverName: string };
    }>;
  } | null;
}

export function useRouteDuties(routeId: string) {
  const { data, loading, error } = useQuery<RouteDutiesQueryData>(ROUTE_DUTIES_QUERY, {
    variables: { routeId },
  });
  return {
    data: data?.route?.duties.map(toDutyDomain) as Duty[] | undefined,
    loading,
    error,
  };
}
```

Create `frontend/src/features/routes/application/queries/useUnitsForDutyForm.query.ts`:

```typescript
import { useQuery } from '@apollo/client/react';
import { UNITS_FOR_DUTY_FORM_QUERY } from '../../infrastructure/duties.graphql';

interface UnitsForDutyFormData {
  units: Array<{ id: string; name: string; driverName: string }>;
}

export function useUnitsForDutyForm() {
  const { data, loading, error } = useQuery<UnitsForDutyFormData>(UNITS_FOR_DUTY_FORM_QUERY);
  return { data: data?.units, loading, error };
}
```

- [ ] **Step 10: Mutation hooks**

Create `frontend/src/features/routes/application/mutations/useCreateDuty.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { CREATE_DUTY_MUTATION, ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { ROUTES_QUERY } from '../../infrastructure/routes.graphql';
import { fromCreateDutyInput } from '../../infrastructure/duties.transform';
import type { TDutyForm } from '../../domain/duty.form';

export function useCreateDuty(routeId: string) {
  const [mutate, { loading, error }] = useMutation(CREATE_DUTY_MUTATION, {
    refetchQueries: [{ query: ROUTE_DUTIES_QUERY, variables: { routeId } }, { query: ROUTES_QUERY }],
  });

  async function createDuty(form: TDutyForm) {
    return mutate({ variables: { input: fromCreateDutyInput(routeId, form) } });
  }

  return { createDuty, loading, error };
}
```

Create `frontend/src/features/routes/application/mutations/useUpdateDuty.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { UPDATE_DUTY_MUTATION, ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { fromUpdateDutyInput } from '../../infrastructure/duties.transform';
import type { TDutyForm } from '../../domain/duty.form';

export function useUpdateDuty(routeId: string) {
  const [mutate, { loading, error }] = useMutation(UPDATE_DUTY_MUTATION, {
    refetchQueries: [{ query: ROUTE_DUTIES_QUERY, variables: { routeId } }],
  });

  async function updateDuty(id: string, form: TDutyForm) {
    return mutate({ variables: { id, input: fromUpdateDutyInput(form) } });
  }

  return { updateDuty, loading, error };
}
```

Create `frontend/src/features/routes/application/mutations/useDeleteDuty.mutation.ts`:

```typescript
import { useMutation } from '@apollo/client/react';
import { DELETE_DUTY_MUTATION, ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { ROUTES_QUERY } from '../../infrastructure/routes.graphql';

export function useDeleteDuty(routeId: string) {
  const [mutate, { loading, error }] = useMutation(DELETE_DUTY_MUTATION, {
    refetchQueries: [{ query: ROUTE_DUTIES_QUERY, variables: { routeId } }, { query: ROUTES_QUERY }],
  });

  async function deleteDuty(id: string) {
    return mutate({ variables: { id } });
  }

  return { deleteDuty, loading, error };
}
```

- [ ] **Step 11: Duty row molecule**

Create `frontend/src/features/routes/ui/molecules/dutyRow.tsx`:

```tsx
import { Button } from '@/shared/ui/atoms/button';
import type { Duty } from '../../domain/duty.model';
import styles from './dutyRow.module.css';

interface DutyRowProps {
  duty: Duty;
  onEdit: () => void;
  onDelete: () => void;
}

export function DutyRow({ duty, onEdit, onDelete }: DutyRowProps) {
  return (
    <div className={styles.row}>
      <span>
        {duty.unit.name} ({duty.unit.driverName})
      </span>
      <span>
        {duty.startsAt.toLocaleString()} – {duty.endsAt.toLocaleString()}
      </span>
      <div className={styles.actions}>
        <Button type="button" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/molecules/dutyRow.module.css`:

```css
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.actions {
  display: flex;
  gap: var(--space-sm);
}
```

- [ ] **Step 12: Duty form content molecule**

Accessible labels (`aria-label`) on the unit select and the two datetime inputs matter here beyond the usual a11y reason — they're what makes the overlap-error test in Step 15 able to target the exact fields reliably.

Create `frontend/src/features/routes/ui/molecules/dutyFormContent.tsx`:

```tsx
'use client';

import { useFormContext } from 'react-hook-form';
import { Button } from '@/shared/ui/atoms/button';
import type { TDutyForm } from '../../domain/duty.form';
import styles from './dutyFormContent.module.css';

interface DutyFormContentProps {
  units: Array<{ id: string; name: string; driverName: string }>;
  disabled: boolean;
  error?: string;
  submitLabel: string;
  onCancel?: () => void;
}

export function DutyFormContent({ units, disabled, error, submitLabel, onCancel }: DutyFormContentProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TDutyForm>();

  return (
    <div className={styles.form}>
      <select {...register('unitId')} aria-label="Unit" disabled={disabled} className={styles.select}>
        <option value="">Select a unit</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} — {unit.driverName}
          </option>
        ))}
      </select>
      {errors.unitId ? <p className={styles.error}>{errors.unitId.message}</p> : null}
      <input
        {...register('startsAt')}
        aria-label="Start time"
        disabled={disabled}
        type="datetime-local"
        className={styles.input}
      />
      {errors.startsAt ? <p className={styles.error}>{errors.startsAt.message}</p> : null}
      <input
        {...register('endsAt')}
        aria-label="End time"
        disabled={disabled}
        type="datetime-local"
        className={styles.input}
      />
      {errors.endsAt ? <p className={styles.error}>{errors.endsAt.message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" disabled={disabled} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/molecules/dutyFormContent.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 320px;
}

.select,
.input {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font: inherit;
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

.error {
  color: var(--color-error);
  font-size: 0.875rem;
}
```

- [ ] **Step 13: Duties organism (create/edit/delete, inline overlap error)**

Create `frontend/src/features/routes/ui/organisms/routeDutiesOrganism.tsx`:

```tsx
'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouteDuties } from '../../application/queries/useRouteDuties.query';
import { useUnitsForDutyForm } from '../../application/queries/useUnitsForDutyForm.query';
import { useCreateDuty } from '../../application/mutations/useCreateDuty.mutation';
import { useUpdateDuty } from '../../application/mutations/useUpdateDuty.mutation';
import { useDeleteDuty } from '../../application/mutations/useDeleteDuty.mutation';
import { dutyFormDefinition, dutyDefaultValues, type TDutyForm } from '../../domain/duty.form';
import { toDatetimeLocalValue } from '../../domain/duty.logic';
import { DutyRow } from '../molecules/dutyRow';
import { DutyFormContent } from '../molecules/dutyFormContent';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import type { Duty } from '../../domain/duty.model';
import styles from './routeDutiesOrganism.module.css';

interface RouteDutiesOrganismProps {
  routeId: string;
}

function dutyErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  const code = getGraphQLErrorCode(error);
  if (code === 'dutyOverlap') return 'This unit already has a duty during that window.';
  if (code === 'invalidDutyWindow') return 'The end time must be after the start time.';
  return 'Failed to save duty. Please try again.';
}

export function RouteDutiesOrganism({ routeId }: RouteDutiesOrganismProps) {
  const { data: duties, loading, error } = useRouteDuties(routeId);
  const { data: units } = useUnitsForDutyForm();
  const { createDuty, loading: creating, error: createError } = useCreateDuty(routeId);
  const { updateDuty, loading: updating, error: updateError } = useUpdateDuty(routeId);
  const { deleteDuty } = useDeleteDuty(routeId);
  const [editingDuty, setEditingDuty] = React.useState<Duty | null>(null);

  const saving = creating || updating;
  const saveError = editingDuty ? updateError : createError;

  const methods = useForm<TDutyForm>({
    values: editingDuty
      ? dutyDefaultValues({
          unitId: editingDuty.unitId,
          startsAt: toDatetimeLocalValue(editingDuty.startsAt),
          endsAt: toDatetimeLocalValue(editingDuty.endsAt),
        })
      : dutyDefaultValues(),
    resolver: zodResolver(dutyFormDefinition),
  });

  async function onSubmit(data: TDutyForm) {
    if (saving) return;
    if (editingDuty) {
      await updateDuty(editingDuty.id, data);
      setEditingDuty(null);
      return;
    }
    await createDuty(data);
    methods.reset(dutyDefaultValues());
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this duty?')) return;
    void deleteDuty(id);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load duties" />;

  return (
    <div className={styles.section}>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <DutyFormContent
            units={units ?? []}
            disabled={saving}
            error={dutyErrorMessage(saveError)}
            submitLabel={editingDuty ? 'Save changes' : 'Assign duty'}
            onCancel={editingDuty ? () => setEditingDuty(null) : undefined}
          />
        </form>
      </FormProvider>
      {!duties?.length ? (
        <EmptyState message="No duties assigned to this route yet" />
      ) : (
        <div className={styles.list}>
          {duties.map((duty) => (
            <DutyRow
              key={duty.id}
              duty={duty}
              onEdit={() => setEditingDuty(duty)}
              onDelete={() => handleDelete(duty.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Create `frontend/src/features/routes/ui/organisms/routeDutiesOrganism.module.css`:

```css
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.list {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 14: Wire into the detail template**

Edit `frontend/src/features/routes/ui/templates/routeDetailTemplate.tsx` to its final form:

```tsx
import { RouteMapOrganism } from '../organisms/routeMapOrganism';
import { RouteDutiesOrganism } from '../organisms/routeDutiesOrganism';
import { EditRouteOrganism } from '../organisms/editRouteOrganism';
import styles from './routeDetailTemplate.module.css';

interface RouteDetailTemplateProps {
  routeId: string;
}

export function RouteDetailTemplate({ routeId }: RouteDetailTemplateProps) {
  return (
    <div className={styles.layout}>
      <RouteMapOrganism routeId={routeId} />
      <RouteDutiesOrganism routeId={routeId} />
      <EditRouteOrganism routeId={routeId} />
    </div>
  );
}
```

- [ ] **Step 15: Write the overlap-error test — the spec's core UI requirement**

Create `frontend/src/test/routes/ui/routeDutiesOrganism.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing/react';
import {
  ROUTE_DUTIES_QUERY,
  UNITS_FOR_DUTY_FORM_QUERY,
  CREATE_DUTY_MUTATION,
} from '@/features/routes/infrastructure/duties.graphql';
import { RouteDutiesOrganism } from '@/features/routes/ui/organisms/routeDutiesOrganism';

const routeId = 'route-1';

const baseMocks = [
  {
    request: { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
    result: { data: { route: { id: routeId, duties: [] } } },
  },
  {
    request: { query: UNITS_FOR_DUTY_FORM_QUERY },
    result: { data: { units: [{ id: 'unit-1', name: 'Truck 1', driverName: 'Alex' }] } },
  },
];

describe('RouteDutiesOrganism', () => {
  it('shows a specific inline error — not a generic message — when the backend reports a duty overlap', async () => {
    const user = userEvent.setup();
    const startsAt = '2026-09-01T08:00';
    const endsAt = '2026-09-01T09:00';

    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CREATE_DUTY_MUTATION,
          variables: {
            input: {
              routeId,
              unitId: 'unit-1',
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
            },
          },
        },
        result: {
          errors: [
            { message: 'Duty overlaps with existing duty duty-9', extensions: { code: 'dutyOverlap' } },
          ],
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RouteDutiesOrganism routeId={routeId} />
      </MockedProvider>,
    );

    await screen.findByText('No duties assigned to this route yet');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'unit-1');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: startsAt } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: endsAt } });
    await user.click(screen.getByRole('button', { name: 'Assign duty' }));

    expect(
      await screen.findByText('This unit already has a duty during that window.'),
    ).toBeInTheDocument();
  });

  it('creates a duty and lists it when there is no conflict', async () => {
    const user = userEvent.setup();
    const startsAt = '2026-09-01T08:00';
    const endsAt = '2026-09-01T09:00';

    const mocks = [
      ...baseMocks,
      {
        request: {
          query: CREATE_DUTY_MUTATION,
          variables: {
            input: {
              routeId,
              unitId: 'unit-1',
              startsAt: new Date(startsAt).toISOString(),
              endsAt: new Date(endsAt).toISOString(),
            },
          },
        },
        result: { data: { createDuty: { id: 'duty-1' } } },
      },
      {
        request: { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
        result: {
          data: {
            route: {
              id: routeId,
              duties: [
                {
                  id: 'duty-1',
                  unitId: 'unit-1',
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                  unit: { id: 'unit-1', name: 'Truck 1', driverName: 'Alex' },
                },
              ],
            },
          },
        },
      },
    ];

    render(
      <MockedProvider mocks={mocks}>
        <RouteDutiesOrganism routeId={routeId} />
      </MockedProvider>,
    );

    await screen.findByText('No duties assigned to this route yet');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Unit' }), 'unit-1');
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: startsAt } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: endsAt } });
    await user.click(screen.getByRole('button', { name: 'Assign duty' }));

    expect(await screen.findByText('Truck 1 (Alex)')).toBeInTheDocument();
  });
});
```

- [ ] **Step 16: Run the tests**

```bash
pnpm test
```

Expected: all PASS, including both `RouteDutiesOrganism` cases.

- [ ] **Step 17: Build and lint**

```bash
pnpm build
pnpm lint
```

- [ ] **Step 18: Manually verify the overlap rule end to end**

With backend + MongoDB running and `pnpm dev` up: on a route's detail page, assign a duty to a unit for a window, then try to assign a second, overlapping duty to the *same* unit — confirm the inline error appears next to the form (not a toast), and that a non-overlapping duty for the same unit succeeds.

- [ ] **Step 19: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): duty scheduling on the route detail page, with inline overlap errors"
```

---

## Task 8: Final integration — README, full validation pass, manual walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README's stack table and commands**

In `README.md`, change the `Mapa` row of the stack table from:

```markdown
| Mapa       | Por definir con el prompt del MVP     |
```

to:

```markdown
| Mapa       | Leaflet + OpenStreetMap (react-leaflet) |
```

And in the `## Calidad` section, add a frontend test line after the frontend build line:

```markdown
pnpm --filter frontend build  # typecheck + build
pnpm --filter frontend test   # Vitest + React Testing Library
```

- [ ] **Step 2: Full validation pass — backend untouched, frontend clean**

```bash
pnpm --filter frontend build
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm format:check
```

All four must pass clean. If `format:check` fails, run `pnpm format` from the repo root and re-check the diff is only whitespace/quote-style before committing.

- [ ] **Step 3: Manual golden-path walkthrough**

With `cd backend && pnpm start:dev` and MongoDB running, then `cd frontend && pnpm dev`:

1. Visit `/` → redirects to `/routes`.
2. `/units` → create two units (e.g. "Truck 1" / "Alex", "Truck 2" / "Sam"). Confirm they appear in the list.
3. Edit "Truck 1"'s driver name inline; confirm it updates in place.
4. `/routes` → create a route with 2+ points; confirm redirect to its detail page.
5. On the detail page: confirm the map renders with markers + a connecting line; confirm the edit form is pre-filled; assign a duty to "Truck 1" for a window; assign a second, non-overlapping duty to "Truck 1"; attempt a third, overlapping duty to "Truck 1" and confirm the inline "already has a duty during that window" error.
6. Try deleting "Truck 1" from `/units` — confirm it's blocked with the active-duties message.
7. Delete both of "Truck 1"'s duties from the route detail page, then delete "Truck 1" from `/units` — confirm it now succeeds.
8. Try deleting the route while it still has "Truck 2" or other duties on it (if any remain) — confirm blocked; otherwise delete it and confirm redirect to `/routes` with the route gone from the list.

Report any deviation from this walkthrough before considering the task done — do not claim the frontend works without having actually clicked through it.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for the finished frontend (map stack, test command)"
```

---

## Post-plan note (not a task — read before executing)

This plan does not include: authentication (none in the MVP), automated E2E tests (`agent_docs/frontend/testing.md` defers Playwright until a real need shows up), or a "conflict visualization" UI (explicitly out of scope per the design spec §8). If the assessment later asks for any of those, treat it as new scope requiring its own brainstorming pass, not a silent addition to this plan.
