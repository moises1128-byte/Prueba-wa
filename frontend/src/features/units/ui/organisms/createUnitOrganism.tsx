'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { unitFormDefinition, unitDefaultValues, type TUnitForm } from '../../domain/unit.form';
import { useCreateUnit } from '../../application/mutations/useCreateUnit.mutation';
import { useUpdateUnit } from '../../application/mutations/useUpdateUnit.mutation';
import { UnitFormContent } from '../molecules/unitFormContent';
import { useUnitEdit } from '../context/unitEditContext';

export function CreateUnitOrganism() {
  const { editingUnit, stopEditing } = useUnitEdit();
  const { createUnit, loading: creating, error: createError } = useCreateUnit();
  const { updateUnit, loading: updating, error: updateError } = useUpdateUnit();

  const methods = useForm<TUnitForm>({
    values: unitDefaultValues(editingUnit ?? undefined),
    resolver: zodResolver(unitFormDefinition),
  });

  const loading = creating || updating;
  const error = editingUnit ? updateError : createError;

  async function onSubmit(data: TUnitForm) {
    if (loading) return;
    if (editingUnit) {
      await updateUnit(editingUnit.id, data);
      stopEditing();
      return;
    }
    await createUnit(data);
    methods.reset(unitDefaultValues());
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
