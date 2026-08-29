---
description: Frontend routing — route builder functions, App Router organization
globs: "frontend/src/shared/routes/*.ts, frontend/src/app/**/*.tsx"
alwaysApply: false
---

# Routing

There is no authentication in this MVP yet, so there's no route-protection middleware or
public/protected classification to maintain. If auth is added later, that's the point to
introduce a `middleware.ts` and a route classification table — don't build it speculatively now.

## Route builders

All navigation uses `routeBuilders` from `shared/routes/routes.ts`. No magic strings.

- Every route is a **function** — even static ones. This keeps a single pattern and allows adding
  params later without a call-site rewrite.
- `ROUTE_PATHS` is the internal constant with path strings.

```typescript
// shared/routes/routes.ts
const ROUTE_PATHS = {
  HOME: '/',
  DUTIES: '/duties',
  DUTY_DETAIL: '/duties/[id]',
} as const;

export const routeBuilders = {
  home: () => ROUTE_PATHS.HOME,
  duties: () => ROUTE_PATHS.DUTIES,
  dutyDetail: (id: string) => `/duties/${id}`,
} as const;
```

---

## Navigation patterns

**Links** — use `next/link` with `routeBuilders`:

```tsx
import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';

<Link href={routeBuilders.duties()}>View Duties</Link>
```

**Programmatic navigation** — use `useRouter` with `routeBuilders`:

```tsx
const router = useRouter();
router.push(routeBuilders.dutyDetail(duty.id));
```

---

## App directory organization

```
app/
  layout.tsx              # Root layout (ApolloProvider, global header)
  page.tsx                # Home
  duties/
    page.tsx               # List (renders a feature page component)
    [id]/
      page.tsx              # Detail
```

Pages are thin wrappers — import from features and add metadata:

```tsx
// app/duties/page.tsx
import { DutySchedulerPage } from '@/features/duties/ui/pages/dutySchedulerPage';

export const metadata = { title: 'Duties' };

export default function DutiesRoute() {
  return <DutySchedulerPage />;
}
```

---

## Adding a new route

1. Add path to `ROUTE_PATHS` in `shared/routes/routes.ts`.
2. Add a builder function to `routeBuilders`.
3. Create the `page.tsx` in `app/`.
4. Page delegates to a feature page component — no business logic in the route file.

---

## Key files

- `src/shared/routes/routes.ts` — Route paths and builders

---

## Anti-patterns

- **Magic strings** — Never use `router.push('/duties')`. Always use `routeBuilders.duties()`.
- **Duplicated route paths** — All paths live in `ROUTE_PATHS`. Don't define paths anywhere else.
- **Business logic in route files** — `page.tsx` files are thin wrappers that delegate to feature
  pages (see `agent_docs/frontend/architecture.md`'s Atomic Design "Pages" level).
