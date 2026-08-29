---
description: React component internal structure — import order, naming by Atomic Design level, max 150-200 lines
globs: "frontend/src/features/**/ui/**/*.tsx, frontend/src/shared/ui/**/*.tsx"
alwaysApply: false
---

# Component Structure

## Internal order

1. **Imports**
2. **Types & interfaces** — props interface named `[ComponentName]Props`
3. **Component function** (function declaration, not arrow)
   1. Hooks — `useState`, `useRef`, custom hooks, `useEffect`
   2. Derived values — computed from props/state, no side effects
   3. Handlers — `handleX` / `onX` functions
   4. JSX return — only markup, no inline logic

```tsx
// features/duties/ui/molecules/dutyStatusBadge.tsx — a molecule: one atom (Badge) + domain-aware color logic
import React from 'react';
import { Badge } from '@/shared/ui/atoms/badge';
import type { TDutyStatus } from '../../domain/duty.constants';
import { dutyStatusLabel, dutyStatusTone } from '../../domain/duty.logic';

interface DutyStatusBadgeProps {
  status: TDutyStatus;
}

export function DutyStatusBadge({ status }: DutyStatusBadgeProps) {
  // Derived values
  const label = dutyStatusLabel(status);
  const tone = dutyStatusTone(status);

  // JSX
  return <Badge tone={tone}>{label}</Badge>;
}
```

```tsx
// features/duties/ui/organisms/dutyListOrganism.tsx — an organism: owns data + all states
'use client';

import React from 'react';
import { useDuties } from '../../application/queries/useDuties.query';
import { DutyCard } from '../molecules/dutyCard';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { Skeleton } from '@/shared/ui/atoms/skeleton';

export function DutyListOrganism() {
  // Hooks
  const { data, loading, error } = useDuties();

  // JSX — loading/error/empty handled here, nowhere else
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message="Could not load duties" />;
  if (!data?.length) return <EmptyState message="No duties yet" />;

  return (
    <div className="flex flex-col gap-2">
      {data.map((duty) => (
        <DutyCard key={duty.id} duty={duty} />
      ))}
    </div>
  );
}
```

---

## Naming

- **Component name**: PascalCase, named by intention — `DutyStatusBadge`, `DutyListOrganism`.
  Suffix organisms with `Organism`, templates with `Template`, and pages with `Page` — atoms and
  molecules stay unsuffixed (`Button`, `LabeledInput`), since their level is already obvious from
  their folder.
- **File name**: camelCase matching the component — `dutyStatusBadge.tsx` exports `DutyStatusBadge`.
- **Props interface**: `[ComponentName]Props`.

---

## Size & splitting

- **~150-200 lines max** per component. Beyond that, split.
- Split when: JSX reads like a full page, multiple unrelated state variables, multiple unrelated
  handlers. A component that's outgrowing its file is usually a sign it should move up a level —
  e.g. a molecule accreting data-fetching logic should become an organism instead of growing in
  place.
- **One exported component per file.** Internal helpers are fine but unexported.

---

## Function declarations

- Use function declarations for components, **not arrow functions**.
- Arrow components can't be hoisted and are harder to identify in stack traces.

---

## Stateful vs stateless, mapped to Atomic Design

- **Organisms** (stateful): fetch data, manage state, call mutations, handle loading/error/empty.
- **Atoms & molecules** (stateless): receive data via props, render UI, emit events via callbacks.
- **Templates**: stateless composition of organisms — no data fetching, no business logic.
- **Pages**: thin — resolve route params, render one template.

```tsx
// Organism — owns data
export function DutyListOrganism() {
  const { data, loading, error } = useDuties();
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message="Could not load duties" />;
  if (!data?.length) return <EmptyState message="No duties yet" />;
  return <div>{data.map((d) => <DutyCard key={d.id} duty={d} />)}</div>;
}

// Molecule — pure rendering
export function DutyCard({ duty }: { duty: Duty }) {
  return (
    <div className="flex items-center gap-2">
      <span>{duty.title}</span>
      <DutyStatusBadge status={duty.status} />
    </div>
  );
}
```

---

## Props

- Always destructure in the function signature.
- Define defaults in the signature.
- Prefer explicit props over uncontrolled spreading (`{...props}`).

---

## Anti-patterns

- **Arrow function components** — Use function declarations.
- **Inline logic in JSX** — Move complex expressions to derived values or handlers above the return.
- **Multiple exports** — One component per file.
- **God components** — Split into organism (data + states) and molecules/atoms (presentational).
- **A template that fetches data** — That's an organism's job; keep templates pure composition.
- **A feature-specific concept living in an atom** — If a component imports a domain type
  (`Duty`, `Employee`), it's a molecule or organism, not an atom.
- **Props drilling beyond 3 levels** — Use Context or composition instead.
