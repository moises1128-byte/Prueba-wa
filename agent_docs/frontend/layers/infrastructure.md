---
description: Infrastructure layer — GraphQL documents, DTO transforms, Apollo Client wiring
globs: 'frontend/src/features/**/infrastructure/*.ts'
alwaysApply: false
---

# Infrastructure Layer

Adapts the GraphQL API to the shapes the rest of the app works with. This is the only layer that
knows the GraphQL schema's actual field names and types.

---

## What lives here

```
features/<feature>/infrastructure/
  *.graphql.ts       # gql-tagged query/mutation/fragment documents
  *.transform.ts      # GraphQL response ↔ Domain mapping functions
```

There is no separate "API client" package in this project (no `@repo/services`) — the single
Apollo Client instance is created once in `lib/apolloClient.ts` and used by every feature's query
and mutation hooks via `@apollo/client`'s `useQuery`/`useMutation`, which read it from React
context (`ApolloProvider`).

---

## GraphQL documents (`*.graphql.ts`)

Every query and mutation is a named, exported `gql` document. Request exactly the fields the
feature needs — don't over-fetch just because a field exists on the type.

```typescript
// features/duties/infrastructure/duties.graphql.ts
import { gql } from '@apollo/client';

export const DUTIES_QUERY = gql`
  query Duties {
    duties {
      id
      title
      assigneeId
      startsAt
      endsAt
      status
    }
  }
`;

export const CREATE_DUTY_MUTATION = gql`
  mutation CreateDuty($input: CreateDutyInput!) {
    createDuty(input: $input) {
      id
      title
      assigneeId
      startsAt
      endsAt
      status
    }
  }
`;
```

Rules:

- Name every operation (`query Duties`, not an anonymous `query { ... }`) — named operations show
  up by name in Apollo DevTools and server logs, which matters the moment there's more than one.
- Co-locate the query/mutation with the feature that owns it. A shared fragment used by 2+
  features can live in `shared/graphql/`.

---

## Transforms (`*.transform.ts`)

Pure functions that map between the GraphQL response shape and the domain model, and between form
data and mutation input variables.

```typescript
// features/duties/infrastructure/duties.transform.ts
import type { Duty } from '../domain/duty.model';
import type { TCreateDutyForm } from '../domain/duty.form';

// GraphQL response → Domain model
export function toDutyDomain(dto: {
  id: string;
  title: string;
  assigneeId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}): Duty {
  return {
    id: dto.id,
    title: dto.title,
    assigneeId: dto.assigneeId,
    startsAt: new Date(dto.startsAt),
    endsAt: new Date(dto.endsAt),
    status: dto.status as Duty['status'],
  };
}

// Form data → mutation input variables
export function fromCreateDutyInput(form: TCreateDutyForm) {
  return {
    title: form.title,
    assigneeId: form.assigneeId,
    startsAt: form.startsAt.toISOString(),
    endsAt: form.endsAt.toISOString(),
  };
}
```

Rules:

- Transforms are pure functions — no I/O, no async, no side effects.
- Name pattern: `toXDomain()` for response→domain, `fromXInput()` for form/domain→mutation
  variables.
- Handle nullability and date (de)serialization explicitly here — GraphQL scalars for dates arrive
  as ISO strings; the domain model uses `Date`. Don't let the raw string leak past this layer.

---

## When you DON'T need a transform

If a query returns exactly the shape the UI needs (rare, but happens for very small features), the
application-layer hook may pass the response through unchanged. Add the transform the moment a
second consumer needs a slightly different shape, or the moment any date/enum coercion is needed.

---

## Apollo Client instance (`lib/apolloClient.ts`)

One client for the whole app, created once:

> Apollo Client v4 split its exports across subpaths — the root package no longer re-exports React bindings or link constructors.

```typescript
// lib/apolloClient.ts
import { ApolloClient, InMemoryCache } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: process.env.NEXT_PUBLIC_GRAPHQL_URL }),
  cache: new InMemoryCache(),
});
```

Wired into the tree once, near the root:

```tsx
// context/apolloProvider.tsx
'use client';

import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '@/lib/apolloClient';

export function AppApolloProvider({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>;
}
```

---

## Anti-patterns

- **`gql` documents defined inline in a component or a query hook** — They belong in
  `infrastructure/*.graphql.ts`.
- **UI components importing `@apollo/client` directly** — Go through the application layer's
  query/mutation hooks.
- **Passing raw GraphQL response data to UI components** — Always map through `*.transform.ts`.
- **Multiple `ApolloClient` instances** — One client per app, instantiated once in `lib/`.
- **Over-fetching** — Request only the fields a feature actually renders; add fields when a new
  consumer needs them, not preemptively.
