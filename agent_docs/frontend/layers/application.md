---
description: Application layer — Apollo Client query/mutation hooks, use cases
globs: 'frontend/src/features/**/application/**/*.ts'
alwaysApply: false
---

# Application Layer

The orchestration layer. Defines _what the system can do_ — queries, mutations, and use cases that
coordinate infrastructure and domain.

---

## What lives here

```
features/<feature>/application/
  queries/
    use*.query.ts          # Apollo Client reads
  mutations/
    use*.mutation.ts       # Apollo Client writes
  useCases/
    *.useCase.ts           # Complex flow orchestration (pure function + hook)
```

---

## Queries (`use*.query.ts`)

Thin wrappers around Apollo Client's `useQuery`, wired to the GraphQL document + transform from
the infrastructure layer. The hook is where the GraphQL response gets mapped into a domain model —
nothing above this layer should see the raw GraphQL shape.

```typescript
// features/duties/application/queries/useDuties.query.ts
import { useQuery } from '@apollo/client';
import { DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { toDutyDomain } from '../../infrastructure/duties.transform';
import type { Duty } from '../../domain/duty.model';

export function useDuties() {
  const { data, loading, error, refetch } = useQuery(DUTIES_QUERY);

  return {
    data: data?.duties.map(toDutyDomain) as Duty[] | undefined,
    loading,
    error,
    refetch,
  };
}
```

Rules:

- The GraphQL document (`DUTIES_QUERY`) lives in `infrastructure/*.graphql.ts` — never inline a
  `gql` tag in the application or UI layer.
- Always map the raw response through `infrastructure/*.transform.ts` before returning it. The UI
  layer only ever sees domain models.
- Return Apollo's `loading` / `error` as-is — don't invent a parallel `isLoading` naming.
- Use Apollo's `skip` / `variables` options for conditional or parameterized fetching.

---

## Mutations (`use*.mutation.ts`)

Wrap Apollo Client's `useMutation`, including cache updates.

```typescript
// features/duties/application/mutations/useCreateDuty.mutation.ts
import { useMutation } from '@apollo/client';
import {
  CREATE_DUTY_MUTATION,
  DUTIES_QUERY,
} from '../../infrastructure/duties.graphql';
import { fromCreateDutyInput } from '../../infrastructure/duties.transform';
import type { TCreateDutyForm } from '../../domain/duty.form';

export function useCreateDuty() {
  const [mutate, { loading, error }] = useMutation(CREATE_DUTY_MUTATION, {
    refetchQueries: [{ query: DUTIES_QUERY }],
  });

  async function createDuty(form: TCreateDutyForm) {
    return mutate({ variables: { input: fromCreateDutyInput(form) } });
  }

  return { createDuty, loading, error };
}
```

Rules:

- Prefer `refetchQueries` for cache invalidation; reach for manual cache writes (`cache.modify`,
  `cache.writeQuery`) only when optimistic UI is required and the extra complexity earns its keep.
- Keep the mutation hook a thin passthrough — user-facing feedback (toast, navigation) belongs in
  a use case or directly in the organism that calls the hook, not baked into the mutation itself.

---

## Use cases (`*.useCase.ts`)

For complex flows that orchestrate multiple queries/mutations, combine business logic beyond
simple CRUD, or need unified loading/error state.

Use cases follow the **pure function + hook** pattern:

1. **Pure function** — `xxxUseCase(input, deps)` — no React imports, no infrastructure imports.
   Receives dependencies as a parameter. Returns a typed result (`{ ok: true } | { ok: false, error }`).
2. **Hook** — `useXxx()` — wires real dependencies (from queries/mutations) and exposes a simple
   API to the UI.

```typescript
// features/duties/application/useCases/createDutyFlow.useCase.ts
import type { Duty } from '../../domain/duty.model';
import type { TCreateDutyForm } from '../../domain/duty.form';

export const CreateDutyFlowErrors = {
  CreationFailed: 'Failed to create duty. Please try again.',
} as const;

export type CreateDutyFlowResult =
  | { ok: true; data: Duty }
  | {
      ok: false;
      error: (typeof CreateDutyFlowErrors)[keyof typeof CreateDutyFlowErrors];
    };

type Dependencies = {
  createDuty: (
    data: TCreateDutyForm,
  ) => Promise<{ data?: { createDuty: unknown } }>;
};

export async function createDutyFlowUseCase(
  input: TCreateDutyForm,
  deps: Dependencies,
): Promise<CreateDutyFlowResult> {
  try {
    const result = await deps.createDuty(input);
    if (!result.data)
      return { ok: false, error: CreateDutyFlowErrors.CreationFailed };
    return { ok: true, data: result.data.createDuty as Duty };
  } catch {
    return { ok: false, error: CreateDutyFlowErrors.CreationFailed };
  }
}
```

```typescript
// features/duties/application/useCases/useCreateDutyFlow.ts
import React from 'react';
import { useCreateDuty } from '../mutations/useCreateDuty.mutation';
import {
  createDutyFlowUseCase,
  type CreateDutyFlowResult,
} from './createDutyFlow.useCase';
import type { TCreateDutyForm } from '../../domain/duty.form';

export function useCreateDutyFlow() {
  const { createDuty, loading } = useCreateDuty();

  const execute = React.useCallback(
    (input: TCreateDutyForm): Promise<CreateDutyFlowResult> =>
      createDutyFlowUseCase(input, { createDuty }),
    [createDuty],
  );

  return { execute, isLoading: loading };
}
```

**When to use a use case vs a simple mutation:** use cases are **optional**. Reach for one when
the flow spans multiple service calls, has business logic beyond CRUD, or needs unified
loading/error state across several operations. For simple CRUD, a mutation hook called directly
from the organism is fine.

---

## Rules

- **Pure use case functions have no React or infrastructure imports.** They receive everything via
  the `deps` parameter.
- **Use case hooks wire dependencies.** They import queries/mutations and pass them to the pure
  function.
- **No direct GraphQL document usage outside `infrastructure/`.** Application-layer hooks import
  documents from `infrastructure/*.graphql.ts`, never define their own.
- **Return typed results from use cases.** Use `{ ok: true, data } | { ok: false, error }` instead
  of throwing.

---

## Anti-patterns

- **`gql` tags defined inline in a query/mutation hook** — Documents belong in
  `infrastructure/*.graphql.ts`; the hook only references them.
- **Returning the raw GraphQL response type from a query hook** — Always transform to a domain
  model first.
- **Business logic in a mutation's `onCompleted`** — If it's more than cache/UI bookkeeping,
  extract to a use case.
- **Use case calling another use case** — Use cases are entry points, not composable building
  blocks.
- **Duplicating GraphQL documents** — One document per operation, defined once in `infrastructure/`.
- **Class-based use cases** — Use the function + hook pattern; it's easier to test (mock individual
  deps) and to compose (unified loading state).
