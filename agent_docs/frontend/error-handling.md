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
    const code = getGraphQLErrorCode(error);
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

#### Submit and delete handlers must absorb the mutation's rejection

Every submit handler that `await`s a mutation needs its own `try/catch`, and every fire-and-forget
delete needs its own `.catch()`. This is **not** redundant with Apollo's own protection — don't
"clean it up".

Apollo v4's `useMutation` does attach a no-op `.catch()` to the promise it hands back
(`preventUnhandledRejection` in `@apollo/client/react/hooks/useMutation.js`), but that only protects
_that_ promise. Every mutation hook in this codebase wraps `mutate()` in its own `async function`
(`async function createUnit(form) { return mutate(...) }`), which produces a **derived** promise
Apollo never sees and therefore never guards. On top of that, react-hook-form's `handleSubmit`
re-throws whatever the submit handler throws. So a rejecting mutation escapes as an unhandled
rejection — console noise in the browser, and a hard test failure the moment a test exercises a
failing mutation on that path.

The `catch` block stays empty on purpose: the UI is driven by the hook's reactive `error` state,
not by the caught error object, so there is nothing left to do with it. Swallowing the rejection
also means the form keeps the user's input instead of resetting it out from under them.

```tsx
async function onSubmit(data: TDutyForm) {
  try {
    await createDuty(data);
    methods.reset(dutyDefaultValues());
  } catch {
    // Rendered from the hook's `error` state — nothing to do here.
  }
}

function handleDelete(id: string) {
  void deleteDuty(id).catch(() => {
    // Rendered from the hook's `error` state — nothing to do here.
  });
}
```

#### Mode-switching forms must reset both mutations

A form that serves both "create" and "edit" reads `editing ? updateError : createError`. Apollo
keeps a mutation's `error` until that mutation runs again, so the un-read error stays stale and
reappears the moment the form switches back. Call both hooks' `reset` in a `useEffect` keyed on the
editing target so every mode change — starting an edit, cancelling, or the post-save stop — clears
both.

```tsx
React.useEffect(() => {
  resetCreateError();
  resetUpdateError();
}, [editingDuty, resetCreateError, resetUpdateError]);
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
- **Empty catch blocks** — `catch (e) {}` hides bugs. Always log, re-throw, or return an error. The
  one sanctioned exception is a submit/delete handler absorbing an Apollo mutation rejection that is
  already surfaced by the hook's reactive `error` state (see above) — comment it as such.
- **Raw `error.message` in UI** — May contain internal details. Show safe messages, and match
  specific `extensions.code` values for specific copy.
- **try/catch "just in case"** — Don't wrap code that cannot fail.
- **`useEffect` + `router.replace` for error handling** — Check `error` from the query hook
  directly in the render path; don't redirect silently on error via a side effect.
