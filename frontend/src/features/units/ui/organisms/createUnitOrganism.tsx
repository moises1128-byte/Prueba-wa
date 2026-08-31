'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  unitFormDefinition,
  unitDefaultValues,
  type TUnitForm,
} from '../../domain/unit.form';
import { useCreateUnit } from '../../application/mutations/useCreateUnit.mutation';
import { useUpdateUnit } from '../../application/mutations/useUpdateUnit.mutation';
import { UnitFormContent } from '../molecules/unitFormContent';
import { useUnitEdit } from '../context/unitEditContext';

export function CreateUnitOrganism() {
  const { editingUnit, stopEditing } = useUnitEdit();
  const {
    createUnit,
    loading: creating,
    error: createError,
    reset: resetCreateError,
  } = useCreateUnit();
  const {
    updateUnit,
    loading: updating,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateUnit();

  const methods = useForm<TUnitForm>({
    values: unitDefaultValues(editingUnit ?? undefined),
    resolver: zodResolver(unitFormDefinition),
  });

  const loading = creating || updating;
  const error = editingUnit ? updateError : createError;

  // Apollo keeps a mutation's `error` until that mutation is fired again, so without
  // this the form would resurrect a stale error the moment it switches modes: fail a
  // create, hit "Edit" (error hides, we now read updateError), then hit "Cancel" —
  // and the old error reappears under a blank create form the user never submitted.
  // Clearing both on every mode change keeps each mode's error from leaking into the
  // other, and also covers the post-successful-update `stopEditing()`.
  React.useEffect(() => {
    resetCreateError();
    resetUpdateError();
  }, [editingUnit, resetCreateError, resetUpdateError]);

  // A failed mutation is already reported through the hook's `error` state, which
  // drives the inline message below. Apollo still rejects the promise, and
  // react-hook-form re-throws whatever the submit handler throws, so the rejection
  // has to be absorbed here or it escapes as an unhandled rejection. Swallowing it
  // also means the form keeps the user's input on failure instead of resetting it
  // out from under them.
  async function onSubmit(data: TUnitForm) {
    if (loading) return;
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, data);
        stopEditing();
        return;
      }
      await createUnit(data);
      methods.reset(unitDefaultValues());
    } catch {
      // Rendered from `error` below — nothing to do here.
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <UnitFormContent
          disabled={loading}
          error={error?.message}
          submitLabel={editingUnit ? 'Save changes' : 'Create unit'}
          onCancel={editingUnit ? stopEditing : undefined}
        />
      </form>
    </FormProvider>
  );
}
