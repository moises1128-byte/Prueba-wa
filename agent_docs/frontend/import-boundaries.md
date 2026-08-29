---
description: Import boundary rules — dependency direction (UI→App→Infra→Domain), no cross-feature imports
globs: 'frontend/src/features/**/*.ts, frontend/src/features/**/*.tsx'
alwaysApply: false
---

# Import Boundaries

Import boundaries enforce the architecture. Without them, layers and features exist only in
documentation.

---

## Dependency direction

```
UI → Application → Infrastructure → Domain
```

Domain is the innermost layer. Every other layer can import from it. Never import in the opposite
direction.

### What can import what

| From \ To                                          | Domain | Infrastructure              | Application | UI   | shared/ |
| -------------------------------------------------- | ------ | --------------------------- | ----------- | ---- | ------- |
| **Domain**                                         | self   | NO                          | NO          | NO   | NO      |
| **Infrastructure**                                 | YES    | self                        | NO          | NO   | NO      |
| **Application**                                    | YES    | YES                         | self        | NO   | NO      |
| **UI** (atoms/molecules/organisms/templates/pages) | YES    | NO (go through Application) | YES         | self | YES     |
| **shared/**                                        | YES    | NO                          | NO          | self | self    |

Within UI, the Atomic Design levels also have a one-way composition direction: pages compose
templates, templates compose organisms, organisms compose molecules/atoms. An atom must never
import an organism.

---

## Cross-feature rules

Features are vertical slices. No feature may import from another feature.

```typescript
// BAD — cross-feature import creates hidden coupling
import { EmployeeAvatar } from '@/features/employees/ui/molecules/employeeAvatar';

// GOOD — promote to shared, both features import from there
import { EmployeeAvatar } from '@/shared/ui/molecules/employeeAvatar';
```

### Promotion paths

When two features need the same thing:

| Question                                                | Location                                     |
| ------------------------------------------------------- | -------------------------------------------- |
| Generic UI atom/molecule, no business logic?            | `shared/ui/atoms/` or `shared/ui/molecules/` |
| Technical helper (formatting, parsing, enum helper)?    | `shared/utils/`                              |
| Cross-cutting capability (file upload, notifications)?  | `shared/` (dedicated subfolder)              |
| Business rule or domain constraint used by 2+ features? | `shared/domain/`                             |
| Specific to one feature?                                | Stays in that feature                        |

Start colocated in the feature. Promote only when reuse is proven (2+ features need it) — see
`agent_docs/backend/architecture.md`'s equivalent rule for the backend side of this same
discipline. Three similar lines beat one premature abstraction.

---

## Route layer (`app/`)

Routes are a thin composition layer. They wire features together but contain no business logic.

```typescript
// GOOD — route delegates to a feature page
// app/duties/page.tsx
import { DutySchedulerPage } from '@/features/duties/ui/pages/dutySchedulerPage';
export default function Page() {
  return <DutySchedulerPage />;
}

// BAD — route contains business logic
// app/duties/page.tsx
import { useQuery } from '@apollo/client';
export default function Page() {
  // fetching and filtering directly in the route file
}
```

Server Actions can be colocated near routes (e.g. `app/duties/actions.ts`) but should delegate to
the domain/application layers, not reimplement logic. See `agent_docs/frontend/routing.md`.

---

## Import order

Nothing enforces import order in this project — write imports in whatever order reads well. Use
`import type` for type-only imports.

---

## Anti-patterns

- **Apollo Client hooks directly in UI components** — UI should go through the Application layer
  (`use*.query.ts` / `use*.mutation.ts`), not call `useQuery`/`useMutation` inline with a `gql` tag.
- **Importing from another feature** — Promote to `shared/` first.
- **Circular dependencies** — If A imports B and B imports A, extract the shared piece to a lower
  layer or `shared/`.
- **`shared/` as a junk drawer** — Every file in `shared/` should be generic. If it contains a
  feature name or `if (feature === 'duties')` branches, it belongs in the feature.
- **An atom importing an organism** — Composition only flows pages→templates→organisms→molecules→atoms.
- **Premature extraction** — Don't move to `shared/` until 2+ features need it.
