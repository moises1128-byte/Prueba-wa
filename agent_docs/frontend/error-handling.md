---
description: Frontend error handling — Apollo Client error/loading state, error.tsx boundaries
globs: 'frontend/src/features/**/application/**/*.ts, frontend/src/app/**/error.tsx'
alwaysApply: false
---

# Error Handling

## Philosophy

Handle expected errors explicitly. Let unexpected errors bubble to error boundaries. Never swallow
errors silently. There is no `Safe<T>` wrapper in this project — Apollo Client's `useQuery` /
`useMutation` already expose `loading` / `error` / `data` directly, which is the boundary shape we
work with.

---

## Error handling by layer

### Infrastructure & Application (query/mutation hooks)

Query and mutation hooks pass through Apollo's `error` (an `ApolloError`) unchanged — they don't
catch it, wrap it, or rename it.

```typescript
// application/queries/useDuties.query.ts
export function useDuties() {
  const { data, loading, error } = useQuery(DUTIES_QUERY);
  return { data: data?.duties.map(toDutyDomain), loading, error };
}
```

`ApolloError` distinguishes network errors (`error.networkError`) from GraphQL errors returned by
the server (`error.graphQLErrors`) — each item in `graphQLErrors` carries `extensions.code`, the
same domain error code the backend attaches (see `agent_docs/backend/error-handling.md`).

```typescript
if (error?.graphQLErrors[0]?.extensions?.code === 'dutyOverlap') {
  // matched a specific backend domain error
}
```

### Application (use cases)

Use cases return typed results — `{ ok: true, data } | { ok: false, error }` — without throwing.
The UI checks `result.ok` directly.

```typescript
export async function createDutyFlowUseCase(
  input: TCreateDutyForm,
  deps: Dependencies,
) {
  try {
    const result = await deps.createDuty(input);
    return { ok: true, data: result.data.createDuty };
  } catch (error) {
    const code = isApolloError(error)
      ? error.graphQLErrors[0]?.extensions?.code
      : undefined;
    if (code === 'dutyOverlap')
      return { ok: false, error: 'This duty overlaps an existing one.' };
    return { ok: false, error: 'Failed to create duty. Please try again.' };
  }
}
```

### UI layer

- **Route-level**: use `error.tsx` for unrecoverable errors — an error boundary for unexpected
  failures.
- **Organism-level**: handle loading/error/empty via Apollo's `loading`, `error`, `data` directly.
- **Never** display a raw `error.message` from an unexpected/network error to users. Show safe,
  user-friendly messages; specific `extensions.code` matches can have specific copy.

```tsx
// features/duties/ui/organisms/dutyListOrganism.tsx
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

#### `error.tsx` — for unrecoverable errors

```tsx
// app/duties/error.tsx
'use client';

export default function DutiesError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <p>Something went wrong loading duties.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## Server Action error handling

Server Actions return a `{ success, ... }` shape — never throw. See
`agent_docs/frontend/layers/server.md` for the full pattern.

---

## Summary: where errors are handled

| Layer                                             | Pattern                                                                 | Throws?                   |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------- |
| Infrastructure (`*.graphql.ts`, `*.transform.ts`) | Pure mapping, no error handling                                         | Never                     |
| Application (query hooks)                         | Passthrough Apollo's `loading`/`error`/`data`                           | Never                     |
| Application (mutation hooks)                      | Passthrough Apollo's `loading`/`error`                                  | Never                     |
| Application (use cases)                           | `try/catch` around `mutateAsync`-equivalent calls, return `{ ok, ... }` | Never (caught internally) |
| Server Actions                                    | Return `{ success, ... }`                                               | Never                     |
| UI (organisms)                                    | Check `loading` / `error` / `data` directly                             | Never                     |
| UI (`error.tsx`)                                  | Catches unexpected thrown errors                                        | Catches                   |

---

## Anti-patterns

- **Wrapping every hook's return in a custom `Safe<T>`-style shape** — Apollo's own
  `loading`/`error`/`data` is already that shape; don't reinvent it.
- **Empty catch blocks** — `catch (e) {}` hides bugs. Always log, re-throw, or return an error.
- **Raw `error.message` in UI** — May contain internal details. Show safe messages, and match
  specific `extensions.code` values for specific copy.
- **try/catch "just in case"** — Don't wrap code that cannot fail.
- **`useEffect` + `router.replace` for error handling** — Check `error` from the query hook
  directly in the render path; don't redirect silently on error via a side effect.
