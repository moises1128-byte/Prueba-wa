'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  unitFormDefinition,
  unitDefaultValues,
  type TUnitForm,
} from '../../domain/unit.form';
import { useCreateUnit } from '../../application/mutations/useCreateUnit.mutation';
import { useUpdateUnit } from '../../application/mutations/useUpdateUnit.mutation';
import { UnitFormContent } from '../molecules/unitFormContent';
import { useUnitEdit } from '../context/unitEditContext';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';

function unitErrorMessage(error: unknown): string {
  const code = getGraphQLErrorCode(error);
  if (code === 'invalidUnit') return 'Los datos de la unidad no son válidos.';
  return 'No se pudo guardar la unidad. Inténtalo de nuevo.';
}

export function CreateUnitOrganism() {
  const { editingUnit, stopEditing } = useUnitEdit();
  const { createUnit, loading: creating } = useCreateUnit();
  const { updateUnit, loading: updating } = useUpdateUnit();

  const methods = useForm<TUnitForm>({
    values: unitDefaultValues(editingUnit ?? undefined),
    resolver: zodResolver(unitFormDefinition),
  });

  const loading = creating || updating;

  // Apollo's `useMutation` rejects on a GraphQL error, and react-hook-form's
  // handleSubmit re-throws whatever the submit handler throws — so the rejection
  // has to be caught here or it escapes as an unhandled rejection. Catching it
  // here also means the form keeps the user's input on failure instead of
  // resetting it out from under them, and lets us show the failure as a toast
  // instead of threading a stale, reactive `error` state through the form.
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
    } catch (error) {
      toast.error(unitErrorMessage(error));
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <UnitFormContent
          disabled={loading}
          submitLabel={editingUnit ? 'Guardar cambios' : 'Crear unidad'}
          onCancel={editingUnit ? stopEditing : undefined}
        />
      </form>
    </FormProvider>
  );
}
