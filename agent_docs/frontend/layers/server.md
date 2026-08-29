---
description: Server layer — Server Actions, Route Handlers, Next.js caching layers (memoization, data cache)
globs: 'frontend/src/app/**/*.ts, frontend/src/app/api/**/*.ts, frontend/next.config.ts'
alwaysApply: false
---

# Server Layer

Everything that runs exclusively on the server: Server Actions, Route Handlers, and caching
strategies.

Apollo Client's `useQuery`/`useMutation` hooks are client-side (see
`agent_docs/frontend/data-fetching.md`) — a Server Action that needs to call the GraphQL API talks
to it with a plain `fetch` against `NEXT_PUBLIC_GRAPHQL_URL`, not through the Apollo Client
instance.

---

## Server Actions

Async functions marked with `'use server'` that handle mutations from Client Components, when
progressive enhancement or `revalidatePath`/`revalidateTag` is genuinely needed. For most
mutations in this project, a Client Component calling `useMutation` directly (see
`agent_docs/frontend/layers/application.md`) is simpler and sufficient — reach for a Server Action
only when one of those specific needs applies.

```typescript
// app/(main)/duties/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createDutyFormDefinition } from '@/features/duties/domain/duty.form';

const CREATE_DUTY_MUTATION = /* GraphQL */ `
  mutation CreateDuty($input: CreateDutyInput!) {
    createDuty(input: $input) {
      id
    }
  }
`;

export async function createDutyAction(formData: FormData) {
  const parsed = createDutyFormDefinition.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' } as const;
  }

  const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: CREATE_DUTY_MUTATION,
      variables: { input: parsed.data },
    }),
  });
  const { data, errors } = await response.json();
  if (errors?.length) {
    return { success: false, error: errors[0].message } as const;
  }

  revalidatePath('/duties');
  return { success: true, data: data.createDuty } as const;
}
```

Rules:

- **Never throw** from Server Actions — return a `{ success, ... }` shape. Thrown errors surface
  as generic messages.
- **Only for mutations** — don't use Server Actions for reads.
- **Keep thin** — validate, call the API, invalidate cache. No business logic.
- **Co-locate near routes** — place `actions.ts` near the route that uses it.

---

## Route Handlers

HTTP endpoints for external callers: webhooks, third-party integrations. For internal UI
mutations, prefer Server Actions or a Client Component `useMutation` call.

```typescript
// app/api/webhooks/example/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // authenticate, validate, process...
  return NextResponse.json({ received: true }, { status: 200 });
}
```

### When to use which

| Scenario                                                              | Use                            |
| --------------------------------------------------------------------- | ------------------------------ |
| UI form submission (needs progressive enhancement / `revalidatePath`) | Server Action                  |
| UI button action (simple case)                                        | Client Component `useMutation` |
| External API consumer                                                 | Route Handler                  |
| Webhook receiver                                                      | Route Handler                  |
| File download / streaming                                             | Route Handler                  |

---

## Caching

Next.js has multiple caching layers, mostly relevant for server-fetched data. Since this project's
reads go through client-side Apollo Client (which has its own normalized cache — see
`agent_docs/frontend/data-fetching.md`), these Next.js layers matter mainly for Server Actions and
any Server Component that fetches directly.

### Request Memoization — `cache()`

Deduplicates identical function calls within a single request.

```typescript
import { cache } from 'react';

export const getDuty = cache(async (id: string) => {
  // fetch by id...
});
```

### Data Cache — `fetch` with `next` options

```typescript
const response = await fetch(process.env.NEXT_PUBLIC_GRAPHQL_URL!, {
  method: 'POST',
  body: JSON.stringify({ query: DUTIES_QUERY }),
  next: { revalidate: 60, tags: ['duties'] },
});
```

### Cache invalidation

```typescript
// In Server Actions:
revalidateTag('duties'); // Preferred — invalidates everything tagged 'duties'
revalidatePath('/duties'); // Alternative — invalidates the specific path
```

---

## Anti-patterns

- **Server Actions for reads** — Use a Server Component fetch, or a Client Component with
  `useQuery`, for reads.
- **Business logic in Route Handlers** — Authenticate, validate, delegate, respond. Business rules
  belong in the domain/application layers.
- **Reaching for a Server Action by default** — Most mutations in this project are simpler as a
  direct `useMutation` call from a Client Component organism; only add a Server Action when its
  specific capabilities (progressive enhancement, `revalidatePath`) are actually needed.
- **`redirect()` inside try/catch** — `redirect()` throws internally. Call it outside try/catch
  blocks.
