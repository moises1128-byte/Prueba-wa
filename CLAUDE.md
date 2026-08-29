# CLAUDE.md (Repo Root)

This file defines **how Claude should work in this repo**. It applies repo-wide to `backend/` and
`frontend/`.

> If a subfolder has its own `CLAUDE.md`, follow the **more specific** rules there. (`frontend/CLAUDE.md`
> is auto-managed by `next dev` — it just points at `AGENTS.md`. Don't hand-edit it.)

---

## Repo overview

**pnpm workspace**, two packages, no shared packages/monorepo tooling (no Turborepo, no `packages/*`).

```
.
├── backend/            # NestJS + GraphQL (code-first, Apollo) + Mongoose API
├── frontend/           # Next.js app
├── agent_docs/         # Architecture & convention docs — backend/, frontend/, conventions.md
├── .prettierrc.json    # Shared formatting config (both apps)
├── pnpm-workspace.yaml
└── package.json
```

This is a local MVP repo (not pushed to GitHub) — a technical assessment project, not a
production system. Keep things proportionate to that: don't add infrastructure (auth, CI,
observability, a shared-packages layer) that isn't asked for.

---

## Stack

### Backend

- **NestJS** + **TypeScript** (strict)
- **GraphQL**, code-first (`@nestjs/graphql` + Apollo) — no REST, no Swagger (GraphQL
  introspection + Apollo Sandbox is the API documentation)
- **MongoDB** via **Mongoose** (`@nestjs/mongoose`)
- **Hexagonal Architecture** (domain / application / ports / infrastructure) — see
  `agent_docs/backend/architecture.md`
- **Vitest** for tests, **oxlint** for linting, **Prettier** for formatting

### Frontend

- **Next.js** (App Router), **React**, **TypeScript** (strict)
- **Apollo Client** for GraphQL data fetching (no REST, no React Query)
- **CSS Modules** for styling (no Tailwind, no shadcn/ui — see `agent_docs/frontend/styling.md`)
- **React Hook Form** + **Zod** for forms
- Layered architecture (domain / application / infrastructure / ui) with **Atomic Design**
  (atoms/molecules/organisms/templates/pages) inside the ui layer — see
  `agent_docs/frontend/architecture.md`
- **ESLint** for linting, **Prettier** for formatting

### Platform / tooling

- **pnpm workspaces** — one lockfile at the root, `pnpm --filter <backend|frontend> <script>` or
  `cd` into the package.
- **Prettier**, configured once at the root (`.prettierrc.json`) and shared by both apps —
  `pnpm format` / `pnpm format:check` from the root formats everything; each app also has its own
  `pnpm format` scoped to its `src/`.
- No Renovate, no CI pipeline configured yet — this is a local-only repo for now.

---

## How Claude should work

### Research → Plan → Implement → Validate

- **Research**: read `agent_docs/backend/*` or `agent_docs/frontend/*` for the relevant layer
  before writing code, and follow existing patterns in the codebase.
- **Plan**: for anything beyond a small, obvious change, say what you're about to do before doing
  it.
- **Implement**: smallest consistent change set that follows the architecture docs.
- **Validate**: run the checks below.

### Development cycle

1. **Backend** (`cd backend`):
   - `pnpm build` — typechecks (via `nest build`)
   - `pnpm lint` — oxlint
   - `pnpm test` — Vitest unit/integration tests
   - `pnpm test:e2e` — E2E tests
2. **Frontend** (`cd frontend`):
   - `pnpm build` — typechecks + builds (Next.js)
   - `pnpm lint` — ESLint
   - `pnpm format:check` — Prettier (or `pnpm format` to fix)
3. **Whole repo**: `pnpm format:check` / `pnpm format` from the root formats `agent_docs/`,
   `README.md`, and both apps' source in one pass.
4. For UI-visible changes, actually run the dev server (`pnpm start:dev` in `backend/`,
   `pnpm dev` in `frontend/`) and check the result — don't claim a frontend change works without
   having looked at it.

---

## Repo-wide conventions

### General

- **camelCase** for directories and files (see each app's `code-standard.md` for the small set of
  PascalCase exceptions — domain classes on the backend, Atomic Design component names on the
  frontend).
- **Minimal comments** (only "why", not "what").
- Prefer **tests as documentation**.

### TypeScript

- **No `any` / `as any`**.
- Prefer **interfaces** for object shapes; use `type` for unions/mapped types.
- Public functions: **explicit return types**.
- Prefer **function declarations** and **named functions**.
- Prefer **async/await** over `.then()`.
- Validate at the boundary: **`class-validator`** on backend GraphQL `@InputType()` fields,
  **Zod** on frontend forms and GraphQL response transforms. There is no shared schema package
  between the two — the backend's GraphQL schema is the contract, and the frontend hand-writes its
  own GraphQL documents against it.
- Avoid barrel re-exports (`index.ts`) that hide boundaries.
- **No magic strings**. Use the local typed-array enum pattern (`getEnumObjectFromArray`) — see
  `agent_docs/conventions.md`. There is no `@repo/utils` package in this project; the helper is
  defined locally per app.

---

## Where to look next (progressive disclosure)

- **Backend architecture, module patterns, testing, error handling**: `agent_docs/backend/`
- **Frontend architecture (incl. Atomic Design), data fetching, forms, testing**: `agent_docs/frontend/`
- **Repo-wide conventions (enums, validation)**: `agent_docs/conventions.md`
