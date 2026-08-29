---
description: Frontend testing — DI/IoC, unit tests for domain, component tests with RTL, mock at boundaries
globs: 'frontend/src/test/**/*.test.ts, frontend/src/test/**/*.test.tsx'
alwaysApply: false
---

## WHY (quality intent)

We optimize for **tests that are fast, isolated, and maintainable** by designing code with:

- **Dependency Injection (DI)**: dependencies are passed in, not constructed inside modules.
- **Inversion of Control (IoC)**: application/domain depend on **interfaces/contracts** (the
  transform + query/mutation hook boundary), not on Apollo Client internals directly inside
  business logic.

This enables reliable unit tests (pure logic) and focused component tests (rendering + boundaries).

---

## WHAT (testing scope)

1. **Unit tests** for domain logic, pure utilities, validators, formatters, and anything with
   branching logic and edge cases.
2. **Component tests** for UI behavior (render states, user interactions, accessibility
   affordances) — one test file per Atomic Design level that has logic worth testing (organisms
   mostly; atoms/molecules only when they have non-trivial conditional rendering).
3. **Integration tests** for key flows where multiple modules collaborate, still without hitting a
   real network — mock at the Apollo Client boundary (see below).

---

## HOW

### Default workflow = TDD-friendly

Tests give a verifiable target; prefer test-first or test-immediately-after.

### Test file convention (Vitest)

Tests live in `src/test/<feature>/<layer>/`, mirroring the layers (`domain/`, `application/`,
`infrastructure/`, `ui/`) of the code they test — never co-located next to production files, and
always `.test.ts`/`.test.tsx` (not `.spec.`).

```
src/test/duties/
  domain/duty.logic.test.ts
  application/useCreateDuty.mutation.test.tsx
  ui/dutyListOrganism.test.tsx
```

---

## Commands

```bash
cd frontend
pnpm test          # once test scripts are added — see note below
pnpm lint
pnpm build          # typecheck + build
```

This project's `frontend/package.json` doesn't have a test runner configured yet (it was
scaffolded with `create-next-app`, which doesn't include one). Add Vitest + React Testing Library
when the first test is written — don't leave this section aspirational once code depends on it.

---

## 1) DI/IoC rules for testability

**Hard rule:** no module should construct its own external dependencies inside business logic.

- ✅ pass dependencies via function/hook params (DI)
- ✅ depend on the transform/query-hook contracts, not raw Apollo internals, inside use cases (IoC)
- ✅ separate pure logic (domain) from side effects (application/infrastructure)

### What to mock vs what to test "for real"

Mock at **boundaries**:

- Apollo Client (`MockedProvider` from `@apollo/client/testing`, with mocked responses per
  operation), time, randomness

Don't mock:

- your own pure functions (domain `*.logic.ts`)
- your own transforms (`*.transform.ts`)
- DOM rendering (use RTL to interact like a user)

```tsx
// application/useCreateDuty.mutation.test.tsx
import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CREATE_DUTY_MUTATION } from '../../infrastructure/duties.graphql';
import { CreateDutyForm } from '../../ui/organisms/createDutyForm';

const mocks = [
  {
    request: {
      query: CREATE_DUTY_MUTATION,
      variables: { input: { title: 'Night shift' /* ... */ } },
    },
    result: { data: { createDuty: { id: '1', title: 'Night shift' } } },
  },
];

it('submits the form and shows the created duty', async () => {
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <CreateDutyForm />
    </MockedProvider>,
  );
  await userEvent.type(screen.getByPlaceholderText('Title'), 'Night shift');
  await userEvent.click(screen.getByRole('button', { name: /create/i }));
  expect(await screen.findByText(/created/i)).toBeInTheDocument();
});
```

### 2) Test naming + structure

- Prefer `describe("<module>")` + `it("should <behavior>")`
- One behavior per test
- Include edge cases (invalid input, error states)

### 3) Component tests (React Testing Library mindset)

- Test behavior, not implementation details.
- Interact via user events; assert on visible outcomes.
- Prefer accessible queries (role/label/text) — this also doubles as an accessibility check.

### 4) Done = verified

Before considering work complete:

- run the test suite
- ensure lint + typecheck (`next build` typechecks) pass
- no flaky timeouts; stabilize async tests (`findBy*` queries wait automatically; avoid arbitrary
  `setTimeout`/`sleep` in tests)

---

## E2E testing

There's no E2E setup in this project yet. If critical user flows (e.g. "create a duty end to end")
need real-browser coverage later, Playwright is the lighter-weight choice for a single Next.js app
(no separate multi-app mock-HTTP-client layer to build, unlike a Cypress + `MockHttpClient` setup
from a larger monorepo). Add it deliberately when the flow list justifies the setup cost — not
speculatively.

---

## Maintenance rules

- Keep this doc short and universally applicable; irrelevant rules get ignored.
- Prefer separate, focused docs over one bloated file.
- Craft testing conventions intentionally — they affect every future session that reads this.
