'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouteDuties } from '../../application/queries/useRouteDuties.query';
import { useUnitsForDutyForm } from '../../application/queries/useUnitsForDutyForm.query';
import { useCreateDuty } from '../../application/mutations/useCreateDuty.mutation';
import { useUpdateDuty } from '../../application/mutations/useUpdateDuty.mutation';
import { useDeleteDuty } from '../../application/mutations/useDeleteDuty.mutation';
import {
  dutyFormDefinition,
  dutyDefaultValues,
  type TDutyForm,
} from '../../domain/duty.form';
import { toDatetimeLocalValue } from '../../domain/duty.logic';
import { DutyRow } from '../molecules/dutyRow';
import { DutyFormContent } from '../molecules/dutyFormContent';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import type { Duty } from '../../domain/duty.model';
import styles from './routeDutiesOrganism.module.css';

interface RouteDutiesOrganismProps {
  routeId: string;
}

function dutyErrorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  const code = getGraphQLErrorCode(error);
  if (code === 'dutyOverlap')
    return 'This unit already has a duty during that window.';
  if (code === 'invalidDutyWindow')
    return 'The end time must be after the start time.';
  return 'Failed to save duty. Please try again.';
}

export function RouteDutiesOrganism({ routeId }: RouteDutiesOrganismProps) {
  const { data: duties, loading, error } = useRouteDuties(routeId);
  const { data: units } = useUnitsForDutyForm();
  const {
    createDuty,
    loading: creating,
    error: createError,
    reset: resetCreateError,
  } = useCreateDuty(routeId);
  const {
    updateDuty,
    loading: updating,
    error: updateError,
    reset: resetUpdateError,
  } = useUpdateDuty(routeId);
  const { deleteDuty, error: deleteError } = useDeleteDuty(routeId);
  const [editingDuty, setEditingDuty] = React.useState<Duty | null>(null);

  const saving = creating || updating;
  const saveError = editingDuty ? updateError : createError;

  // Apollo keeps a mutation's `error` until that mutation is fired again, so without
  // this the form would resurrect a stale error the moment it switches modes: fail a
  // create with an overlap, hit "Edit" (error hides, we now read updateError), then
  // hit "Cancel" — and the old overlap warning reappears under a blank create form the
  // user never submitted. Clearing both on every mode change keeps each mode's error
  // from leaking into the other.
  React.useEffect(() => {
    resetCreateError();
    resetUpdateError();
  }, [editingDuty, resetCreateError, resetUpdateError]);

  const methods = useForm<TDutyForm>({
    values: editingDuty
      ? dutyDefaultValues({
          unitId: editingDuty.unitId,
          startsAt: toDatetimeLocalValue(editingDuty.startsAt),
          endsAt: toDatetimeLocalValue(editingDuty.endsAt),
        })
      : dutyDefaultValues(),
    resolver: zodResolver(dutyFormDefinition),
  });

  // A failed mutation is already reported through the hook's `error` state, which
  // `dutyErrorMessage` turns into the inline message. Apollo still rejects the
  // promise, and react-hook-form re-throws whatever the submit handler throws, so
  // the rejection has to be absorbed here or it escapes as an unhandled rejection.
  // Swallowing it also means the form keeps the user's input on failure instead of
  // resetting it out from under them.
  async function onSubmit(data: TDutyForm) {
    if (saving) return;
    try {
      if (editingDuty) {
        await updateDuty(editingDuty.id, data);
        setEditingDuty(null);
        return;
      }
      await createDuty(data);
      methods.reset(dutyDefaultValues());
    } catch {
      // Rendered from `saveError` below — nothing to do here.
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this duty?')) return;
    void deleteDuty(id).catch(() => {
      // Rendered from `deleteError` below — nothing to do here.
    });
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load duties" />;

  return (
    <div className={styles.section}>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <DutyFormContent
            units={units ?? []}
            disabled={saving}
            error={dutyErrorMessage(saveError)}
            submitLabel={editingDuty ? 'Save changes' : 'Assign duty'}
            onCancel={editingDuty ? () => setEditingDuty(null) : undefined}
          />
        </form>
      </FormProvider>
      {deleteError ? (
        <ErrorState message="Failed to delete duty. Please try again." />
      ) : null}
      {!duties?.length ? (
        <EmptyState message="No duties assigned to this route yet" />
      ) : (
        <div className={styles.list}>
          {duties.map((duty) => (
            <DutyRow
              key={duty.id}
              duty={duty}
              onEdit={() => setEditingDuty(duty)}
              onDelete={() => handleDelete(duty.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
