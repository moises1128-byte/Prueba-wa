---
description: UI layer — Server/Client Components, Atomic Design (atoms→pages), Context for feature state, UI-only hooks
globs: "frontend/src/features/**/ui/**/*.tsx, frontend/src/shared/ui/**/*.tsx"
alwaysApply: false
---

# UI Layer

Everything the user sees and interacts with. Server Components for data delivery, Client
Components for interactivity, organized internally with Atomic Design (see
`agent_docs/frontend/architecture.md` for the full atoms→pages table).

---

## What lives here

```
shared/ui/
  atoms/            # Generic primitives — Button, Input, Badge, Spinner
  molecules/         # Generic small compositions — LabeledInput, EmptyState, ErrorState

features/<feature>/ui/
  pages/            # Route-level screens (compose one template)
  templates/         # Page-level layout — arranges organisms, no data fetching
  organisms/          # Self-contained sections — own loading/error/empty states
  molecules/          # Feature-specific small compositions (reference a domain type)
  context/            # Feature-scoped React contexts
  hooks/              # Feature UI hooks (visual state only)
```

---

## Server vs Client Components

### Rules of the component tree

- **Server Components (S)** can contain: other Server Components and Client Components.
- **Client Components (C)** can only contain: other Client Components.

The tree starts at the server (layouts, pages) and interactivity is pushed to the leaves.

### When to use each

| Use Server Components when you need | Use Client Components when you need |
|---|---|
| Data fetching on initial load | Interactivity (`onClick`, `onChange`) |
| Reduce JavaScript sent to client | State (`useState`, `useReducer`) |
| Heavy dependencies kept server-side | Effects (`useEffect`) |
| | Apollo Client hooks (`useQuery`, `useMutation`) — client-side by default in this project |

### Strategy

- Keep pages and templates as Server Components by default when they don't need interactivity.
- Since data fetching in this project goes through Apollo Client hooks (client-side — see
  `agent_docs/frontend/data-fetching.md`), most **organisms** end up as Client Components. That's
  expected: push `'use client'` to the organism, not to the whole page.
- Don't mark an entire page as `'use client'` — that sends all its code to the browser.

```tsx
// ✅ — Page stays server, the organism that needs data/interactivity is the client leaf
// features/duties/ui/pages/dutySchedulerPage.tsx (Server Component)
import { DutySchedulerTemplate } from '../templates/dutySchedulerTemplate';

export function DutySchedulerPage() {
  return <DutySchedulerTemplate />;
}
```

```tsx
// features/duties/ui/templates/dutySchedulerTemplate.tsx (Server Component — pure composition)
import { DutyListOrganism } from '../organisms/dutyListOrganism'; // 'use client' inside
import { CreateDutyOrganism } from '../organisms/createDutyOrganism'; // 'use client' inside

export function DutySchedulerTemplate() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <DutyListOrganism />
      <CreateDutyOrganism />
    </div>
  );
}
```

---

## Client Components

Add `'use client'` only at the leaf where interactivity or data fetching begins. Keep the client
boundary as narrow as possible.

### State management decision

| State type | Tool | Example |
|---|---|---|
| Server state (GraphQL data) | Apollo Client cache | `useDuties()`, `useCreateDuty()` |
| Ephemeral UI state | `useState` | Modal open, hover, accordion |
| URL state (shareable) | `useSearchParams` | Filters, pagination, search |
| Global UI state | React Context | Theme, locale |

**Never use Context for server state.** Apollo Client's normalized cache handles caching,
invalidation, and refetching — don't duplicate that with Context or `useState`.

---

## Organism pattern

Organisms are self-contained sections that own their loading, error, and empty states. They
compose molecules and atoms. (This is the level formerly called "widget" — same rules apply,
renamed to fit the Atomic Design vocabulary used across this project.)

```
Organism (owns data + states) → Molecules / Atoms (presentational, stateless)
```

Rules:
- Each organism must be able to **live independently** — if sibling organisms fail or are
  loading, this one still works.
- Each organism renders its own **loading state**, **error state**, and **empty state**.
- Organisms fetch their own data via Apollo Client query hooks from the application layer.
- Molecules and atoms receive data via props — no data fetching.

```tsx
// features/duties/ui/organisms/dutyActivityOrganism.tsx
'use client';

import { useDutyActivity } from '../../application/queries/useDutyActivity.query';
import { Card } from '@/shared/ui/atoms/card';
import { Skeleton } from '@/shared/ui/atoms/skeleton';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';

export function DutyActivityOrganism({ dutyId }: { dutyId: string }) {
  const { data, loading, error } = useDutyActivity(dutyId);

  if (loading) return <Skeleton />;
  if (error) return <Card><ErrorState message="Could not load activity" /></Card>;
  if (!data?.length) return <Card><EmptyState message="No activity yet" /></Card>;

  return (
    <Card>
      <ul>{data.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
    </Card>
  );
}
```

### When to fetch in a Page/Template vs an Organism

By default, each organism fetches its own data. Only fetch higher up (in the page) when:
- **2+ organisms share the same query** — fetch once, pass down as props.
- **A root resource is needed** to decide if the page should render at all (e.g. duty not found).

---

## Context pattern

Use React Context when a piece of state is shared by **2+ organisms** within a feature, or to
avoid prop drilling beyond 3 levels.

Structure: **Type → Provider with `useMemo` → Hook consumer**.

```tsx
// features/onboarding/ui/context/stepperContext.tsx
import React from 'react';

interface StepperContextValue {
  currentStep: number;
  totalSteps: number;
  next: () => void;
  back: () => void;
}

const StepperContext = React.createContext<StepperContextValue | null>(null);

export function StepperProvider({ totalSteps, children }: { totalSteps: number; children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = React.useState(0);

  const value = React.useMemo<StepperContextValue>(
    () => ({
      currentStep,
      totalSteps,
      next: () => setCurrentStep((s) => Math.min(s + 1, totalSteps - 1)),
      back: () => setCurrentStep((s) => Math.max(s - 1, 0)),
    }),
    [currentStep, totalSteps],
  );

  return <StepperContext.Provider value={value}>{children}</StepperContext.Provider>;
}

export function useStepper() {
  const ctx = React.useContext(StepperContext);
  if (!ctx) throw new Error('useStepper must be used within a StepperProvider');
  return ctx;
}
```

Rules:
- Context local to a feature → `features/<feature>/ui/context/`.
- Context shared across features → `shared/`.
- Always wrap the value in `useMemo` to prevent unnecessary re-renders.
- Always provide a hook that validates the context exists.

---

## UI Hooks

Custom hooks that encapsulate **visual state only** — no queries, no mutations, no business logic.

```typescript
// shared/ui/hooks/useDisclosure.ts
import React from 'react';

export function useDisclosure(initialState = false) {
  const [isOpen, setIsOpen] = React.useState(initialState);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v),
  };
}
```

What belongs in UI hooks: open/close/toggle state, scroll position tracking, debounced input
values, tab selection logic.

What does NOT belong: queries or mutations (Application layer), business logic (Domain layer),
state shared across components (Context).

---

## Forms

Use `react-hook-form` + `zodResolver` for all forms. Split into container (form setup + mutation)
and content (fields). See `agent_docs/frontend/forms.md` for the full pattern.

---

## Anti-patterns

- **`'use client'` at page or template level** — Push `'use client'` down to the organism that
  actually needs interactivity or data.
- **Fetching in `useEffect`** — Use an Apollo Client query hook from the application layer.
  `useEffect` fetch creates waterfalls and no caching.
- **Context for server state** — Apollo Client's cache handles this; don't duplicate it.
- **Business logic in event handlers** — Extract to `domain/*.logic.ts` or a use case.
- **Forms without Zod** — Always validate with Zod.
- **A molecule doing an organism's job** — If a "presentational" component starts calling a query
  hook, it has become an organism; rename/move it, don't leave it half-classified.
- **Organisms without their own states** — Every organism must handle loading, error, and empty
  independently.
- **Large Client Components** — Keep `'use client'` boundaries narrow.
