---
description: Form patterns — Zod schema + Form organism + FormContent, react-hook-form + FormProvider
globs: "frontend/src/features/**/domain/*.form.ts, frontend/src/features/**/ui/organisms/*Form*.tsx"
alwaysApply: false
---

# Forms

## Three-piece pattern

Every form splits into three files:

| File | Layer | Responsibility |
|---|---|---|
| `*.form.ts` | Domain | Zod schema, inferred type, default values factory |
| `*Form.tsx` | UI / organisms | `useForm` + `zodResolver` + `FormProvider` + mutation call |
| `*FormContent.tsx` | UI / molecules | Fields + error messages via `useFormContext` |

```
features/duties/
  domain/
    duty.form.ts
  ui/
    organisms/
      createDutyForm.tsx
    molecules/
      createDutyFormContent.tsx
```

The Form organism owns data (the mutation); FormContent is a molecule — pure rendering, reusable
in a modal, a page, or a stepper without duplicating form logic.

---

## Domain: Schema (`*.form.ts`)

Three parts per schema: Zod definition, inferred type, default values factory.

```typescript
// features/duties/domain/duty.form.ts
import { z } from 'zod';

export const createDutyFormDefinition = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  assigneeId: z.string().min(1, 'Assignee is required'),
  startsAt: z.date(),
  endsAt: z.date(),
});

export type TCreateDutyForm = z.infer<typeof createDutyFormDefinition>;

export function createDutyDefaultValues(
  partial?: Partial<TCreateDutyForm>,
): TCreateDutyForm {
  return {
    title: partial?.title ?? '',
    assigneeId: partial?.assigneeId ?? '',
    startsAt: partial?.startsAt ?? new Date(),
    endsAt: partial?.endsAt ?? new Date(),
  };
}
```

Rules:
- Use `.safeParse()`, never `.parse()` (throws).
- Compose sub-schemas for reuse.
- State-dependent validation (e.g. "assignee already has a conflicting duty") belongs in a use
  case, not the schema — the schema only validates shape, not business rules.

---

## UI: Form organism (`*Form.tsx`)

```tsx
// features/duties/ui/organisms/createDutyForm.tsx
'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createDutyFormDefinition,
  createDutyDefaultValues,
  type TCreateDutyForm,
} from '../../domain/duty.form';
import { useCreateDuty } from '../../application/mutations/useCreateDuty.mutation';
import { CreateDutyFormContent } from '../molecules/createDutyFormContent';

export function CreateDutyForm() {
  const { createDuty, loading, error } = useCreateDuty();

  const methods = useForm<TCreateDutyForm>({
    defaultValues: createDutyDefaultValues(),
    resolver: zodResolver(createDutyFormDefinition),
  });

  async function onSubmit(data: TCreateDutyForm) {
    if (loading) return;
    await createDuty(data);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <CreateDutyFormContent disabled={loading} error={error?.message} />
      </form>
    </FormProvider>
  );
}
```

Rules:
- Use the mutation's `loading` as the disabled state — no manual `useState` for this.
- The Form organism does not render fields — delegates to the FormContent molecule.
- For edit forms: `createDutyDefaultValues(existingDuty)`.

---

## UI: Form content (`*FormContent.tsx`)

```tsx
// features/duties/ui/molecules/createDutyFormContent.tsx
'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TCreateDutyForm } from '../../domain/duty.form';

interface CreateDutyFormContentProps {
  disabled: boolean;
  error?: string;
}

export function CreateDutyFormContent({ disabled, error }: CreateDutyFormContentProps) {
  const { register, formState: { errors } } = useFormContext<TCreateDutyForm>();

  return (
    <div className="flex flex-col gap-4">
      <Input {...register('title')} disabled={disabled} placeholder="Title" />
      {errors.title ? <p className="text-error text-sm">{errors.title.message}</p> : null}
      {error ? <p className="text-error text-sm">{error}</p> : null}
      <Button type="submit" disabled={disabled}>Create</Button>
    </div>
  );
}
```

---

## Dynamic validation (`superRefine`)

For cross-field validation — when one field's validity depends on another.

```typescript
import { z } from 'zod';

const dutyDefinition = z.object({
  startsAt: z.date(),
  endsAt: z.date(),
});

export const createDutyFormDefinition = dutyDefinition.superRefine((value, ctx) => {
  if (value.endsAt <= value.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time',
      path: ['endsAt'],
    });
  }
});
```

---

## Anti-patterns

- **Forms without Zod** — Always validate with Zod for client/server consistency.
- **Monolithic form components** — Split into Form (organism, owns the mutation) + FormContent
  (molecule, renders fields).
- **Manual loading state** — Use the mutation's `loading`, not a separate `useState`.
- **Business logic in submit handlers** — Extract to domain logic or a use case.
- **Inline schema definitions** — Define schemas in `domain/*.form.ts`, not inside components.
- **`.parse()` instead of `.safeParse()`** — `.parse()` throws.
