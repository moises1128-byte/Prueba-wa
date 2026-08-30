---
description: Frontend data fetching patterns — Apollo Client queries/mutations, cache, use cases, Server Actions
globs: 'frontend/src/features/**/application/**/*.ts'
alwaysApply: false
---

# Data Fetching

## Decision matrix

| Scenario                                        | Approach                            | Why                                                                             |
| ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| Organism's own data on mount                    | `useQuery` in a query hook          | Apollo's normalized cache handles refetch/dedup automatically                   |
| Client-side pagination / filtering / search     | `useQuery` with dynamic `variables` | Apollo caches per-variable-set                                                  |
| Mutations (form submit, button click)           | `useMutation` + optional use case   | Typed result, use case handles toast + navigation for complex flows             |
| Server-side mutations (progressive enhancement) | Server Actions (`'use server'`)     | `revalidatePath`, works without JS — see `agent_docs/frontend/layers/server.md` |

---

## Query standard — 3 files, 3 responsibilities

Every query follows this split:

```
infrastructure/duties.graphql.ts     → gql document (what to ask the server)
infrastructure/duties.transform.ts   → response → domain mapping
application/queries/useDuties.query.ts → useQuery wrapper, returns domain-shaped data
```

```typescript
// infrastructure/duties.graphql.ts
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
```

```typescript
// application/queries/useDuties.query.ts
import { useQuery } from '@apollo/client/react';
import { DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { toDutyDomain } from '../../infrastructure/duties.transform';

export function useDuties() {
  const { data, loading, error, refetch } = useQuery(DUTIES_QUERY);
  return { data: data?.duties.map(toDutyDomain), loading, error, refetch };
}
```

```tsx
// Organism — consumes the query hook directly
'use client';

export function DutyListOrganism() {
  const { data, loading, error } = useDuties();
  if (loading) return <Skeleton />;
  if (error) return <ErrorState message="Could not load duties" />;
  if (!data?.length) return <EmptyState message="No duties yet" />;
  return (
    <div>
      {data.map((d) => (
        <DutyCard key={d.id} duty={d} />
      ))}
    </div>
  );
}
```

See `agent_docs/frontend/layers/infrastructure.md` and `agent_docs/frontend/layers/application.md`
for the full rules on each file.

---

## Parameterized / conditional queries

```typescript
export function useDutyActivity(dutyId: string) {
  const { data, loading, error } = useQuery(DUTY_ACTIVITY_QUERY, {
    variables: { dutyId },
    skip: !dutyId,
  });
  return { data: data?.dutyActivity.map(toActivityDomain), loading, error };
}
```

Use `skip` instead of an `if` before the hook call — hooks must run unconditionally.

---

## Mutation standard

```typescript
// application/mutations/useCreateDuty.mutation.ts
import { useMutation } from '@apollo/client/react';
import {
  CREATE_DUTY_MUTATION,
  DUTIES_QUERY,
} from '../../infrastructure/duties.graphql';
import { fromCreateDutyInput } from '../../infrastructure/duties.transform';

export function useCreateDuty() {
  const [mutate, { loading, error }] = useMutation(CREATE_DUTY_MUTATION, {
    refetchQueries: [{ query: DUTIES_QUERY }],
  });

  return {
    createDuty: (form: TCreateDutyForm) =>
      mutate({ variables: { input: fromCreateDutyInput(form) } }),
    loading,
    error,
  };
}
```

- `refetchQueries` is the default invalidation strategy — simple, correct, and enough for this
  project's scale. Reach for `cache.modify()` / optimistic response only when a specific UI needs
  instant feedback and the refetch round-trip is visibly too slow.
- Error handling (toast, navigation) belongs in a use case or in the organism that calls the
  mutation — not baked into the mutation hook itself. See
  `agent_docs/frontend/layers/application.md`.

---

## Server Actions

Use when a mutation needs progressive enhancement or `revalidatePath`/`revalidateTag`. See
`agent_docs/frontend/layers/server.md` for the full pattern — Server Actions call the GraphQL API
with a plain `fetch`, since Apollo Client's hooks are client-side only.

---

## Cache behavior to know

- Apollo Client's `InMemoryCache` normalizes objects by `__typename` + `id` by default. Two
  queries returning the same `Duty` will share one cache entry — editing it in one place updates
  every component reading it, without an explicit invalidation.
- If a type doesn't have a stable `id` field, tell the cache explicitly via `typePolicies` in
  `lib/apolloClient.ts`, or accept that it won't be normalized (fine for one-off aggregate/summary
  types).
- `refetchQueries` re-runs the named query against the network. `cache.evict()` +
  `cache.gc()` remove an entry without a network round-trip — useful after a delete mutation.

```typescript
// After a delete mutation — evict instead of refetching the whole list
const [deleteDuty] = useMutation(DELETE_DUTY_MUTATION, {
  update(cache, { data }) {
    cache.evict({
      id: cache.identify({ __typename: 'DutyType', id: data.deleteDuty.id }),
    });
    cache.gc();
  },
});
```

---

## Anti-patterns

- **`gql` tags inline in components or hooks** — Documents belong in `infrastructure/*.graphql.ts`.
- **Fetching in `useEffect`** — Use `useQuery` from the application layer. `useEffect` fetch
  creates waterfalls, loading flashes, and no caching.
- **Returning raw GraphQL response shapes from a query hook** — Always transform to a domain model.
- **Error handling inside the mutation hook** — Put toast/navigation logic in a use case or the
  calling organism, not in `use*.mutation.ts`.
- **Over-fetching "just in case"** — Request only the fields the current consumer renders.
- **Multiple `ApolloClient` instances** — One instance, created once in `lib/apolloClient.ts`.
- **Server Actions for reads** — Server Actions are for mutations.
