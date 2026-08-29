---
description: Frontend Clean Architecture — feature-driven layers (UI with Atomic Design, Application, Domain, Infrastructure)
globs: "frontend/src/features/**/*.ts, frontend/src/features/**/*.tsx"
alwaysApply: false
---

# Frontend Architecture

## Repo Mental Model

We use a **Clean Architecture-inspired** model adapted to React and a **feature-driven**
organization, on a single Next.js app (`frontend/`) — no multi-app monorepo, no shared packages.

### Layers (outside → inside)

- **UI**: screens/components (rendering and visual state), organized internally with **Atomic
  Design** — see below.
- **Application**: orchestration (use-cases, Apollo Client query/mutation hooks).
- **Domain**: business language (models + pure domain rules).
- **Infrastructure**: GraphQL documents, DTO↔domain transforms, Apollo Client wiring.

**Dependency direction** (allowed):

```
UI → Application → Infrastructure → Domain
```

Domain is the innermost layer — every other layer can import from it. **Never** import in the
opposite direction of the arrows above. See `agent_docs/frontend/import-boundaries.md` for the
enforced boundary table.

### Feature-driven organization

We group code by product functionality (a "feature"), not by technical type. A feature is a
complete user-facing capability.

**Promise:** if you delete `features/<feature>`, the rest of the app should still compile (that
capability simply disappears).

### Suggested structure

```
frontend/src/
  app/                 # Next.js routes (thin composition layer)
  context/             # React context providers (Apollo provider, theme, etc.)
  features/            # Product features (vertical slices)
  shared/              # Cross-cutting UI (atoms/molecules shared by 2+ features) + utilities
  lib/                 # App-level helpers (Apollo Client instance, env)
```

See `agent_docs/frontend/routing.md` for route organization and navigation patterns.

## How to slice a feature

A feature should be removable without breaking the rest of the app.

```
[feature-name]/
  ui/
    pages/*.tsx          # — route-level screens (compose templates/organisms; minimal logic)
    templates/*.tsx      # — page-level layout composition (arranges organisms, no data fetching)
    organisms/*.tsx      # — self-contained sections (own loading/error/empty states; the old "widget")
    molecules/*.tsx      # — small composed pieces (a labeled input, a card row) — feature-specific only
    context/*.tsx        # — React context providers scoped to this feature
    hooks/*.ts           # — custom hooks for this feature's UI (visual state only)
  application/
    queries/use*.query.ts       # — Apollo Client reads
    mutations/use*.mutation.ts  # — Apollo Client writes
    useCases/*.useCase.ts       # — flow orchestration (simple API for UI)
  domain/
    *.model.ts          # — domain entities/value objects (frontend-friendly shapes)
    *.logic.ts           # — pure rules/invariants (no side effects)
    *.constants.ts        # — enums, query keys, domain constants
    *.form.ts             # — Zod form schemas, form types, default value factories
  infrastructure/
    *.graphql.ts          # — gql-tagged query/mutation documents
    *.transform.ts         # — GraphQL response ↔ Domain mapping
```

Truly generic, reusable-anywhere pieces (a plain `Button`, an `Input`, a `Badge`) live in
`shared/ui/{atoms,molecules,organisms}/`, not inside a feature — see the Atomic Design section
below for the full split.

## Atomic Design — how the UI layer is organized internally

The **UI** layer (whether in `shared/ui/` or a feature's `ui/`) is structured with Atomic Design's
five levels. This replaces a flat `components/` folder with an explicit hierarchy that makes reuse
and composition obvious at a glance:

| Level | What it is | Lives in | Example |
|---|---|---|---|
| **Atoms** | Smallest, indivisible UI primitives. No business meaning. | `shared/ui/atoms/` | `Button`, `Input`, `Badge`, `Spinner` |
| **Molecules** | A small group of atoms working together as one unit. | `shared/ui/molecules/` (generic) or `features/<f>/ui/molecules/` (feature-specific) | `LabeledInput`, `SearchBar`, `DutyStatusBadge` |
| **Organisms** | A self-contained section that owns its own data, loading/error/empty states. Composes molecules + atoms. This is the old "widget". | `features/<f>/ui/organisms/` | `DutyListOrganism`, `AssignmentMapOrganism` |
| **Templates** | Page-level layout — arranges organisms into a screen skeleton. No data fetching of its own. | `features/<f>/ui/templates/` | `DutySchedulerTemplate` |
| **Pages** | Route-level screen. Composes one template, passes route params down. Thin. | `features/<f>/ui/pages/` | `DutySchedulerPage` |

Rules:

- **Atoms and generic molecules are feature-agnostic.** If a component has no reference to a
  domain concept (no `Duty`, no `Employee` in its props), it belongs in `shared/ui/`, not inside a
  feature.
- **Organisms are the boundary where data fetching happens.** Same rule as the old "widget"
  pattern in `agent_docs/frontend/layers/ui.md` — every organism owns its loading/error/empty
  states and can live independently of its siblings.
- **Templates never fetch data.** They receive organisms as children or render them directly, but
  a template with a `useQuery` call is doing an organism's job.
- **Don't build the full ladder for a one-off component.** A component used in exactly one place,
  with no reuse pressure, can skip straight to being an organism or even live inline in a
  template — promote it down to a molecule/atom only when a second consumer appears (same "promote
  only when reuse is proven" rule as `import-boundaries.md`).

See `agent_docs/frontend/component-structure.md` for the internal structure of a single component
file at any of these levels, and `agent_docs/frontend/layers/ui.md` for Server/Client Component
rules, the organism pattern in detail, and Context usage.
