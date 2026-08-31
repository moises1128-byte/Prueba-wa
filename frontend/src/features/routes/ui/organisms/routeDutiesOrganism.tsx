'use client';

import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
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
import { DutyFormContent } from '../molecules/dutyFormContent';
import { Button } from '@/shared/ui/atoms/button';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import { useConfirm } from '@/context/confirmDialogProvider';
import type { Duty } from '../../domain/duty.model';
import styles from './routeDutiesOrganism.module.css';

interface RouteDutiesOrganismProps {
  routeId: string;
}

function saveDutyErrorMessage(error: unknown): string {
  const code = getGraphQLErrorCode(error);
  if (code === 'dutyOverlap')
    return 'Esta unidad ya tiene un turno asignado en ese horario.';
  if (code === 'invalidDutyWindow')
    return 'La hora de fin debe ser posterior a la de inicio.';
  return 'No se pudo guardar el turno. Inténtalo de nuevo.';
}

export function RouteDutiesOrganism({ routeId }: RouteDutiesOrganismProps) {
  const { data: duties, loading, error } = useRouteDuties(routeId);
  const { data: units } = useUnitsForDutyForm();
  const { createDuty, loading: creating } = useCreateDuty(routeId);
  const { updateDuty, loading: updating } = useUpdateDuty(routeId);
  const { deleteDuty } = useDeleteDuty(routeId);
  const [editingDuty, setEditingDuty] = React.useState<Duty | null>(null);
  const confirm = useConfirm();

  const saving = creating || updating;

  const methods = useForm<TDutyForm>({
    values: editingDuty
      ? dutyDefaultValues({
          unitId: editingDuty.unitId,
          startsAt: toDatetimeLocalValue(editingDuty.startsAt),
          endsAt: toDatetimeLocalValue(editingDuty.endsAt),
          description: editingDuty.description ?? undefined,
        })
      : dutyDefaultValues(),
    resolver: zodResolver(dutyFormDefinition),
  });

  // Apollo's `useMutation` rejects on a GraphQL error, and react-hook-form's
  // handleSubmit re-throws whatever the submit handler throws — so the rejection
  // has to be caught here or it escapes as an unhandled rejection. Catching it
  // also means the form keeps the user's input on failure instead of resetting
  // it out from under them, and lets us show the failure as a one-shot toast
  // instead of threading a stale, reactive `error` state through the form.
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
    } catch (saveError) {
      toast.error(saveDutyErrorMessage(saveError));
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm('¿Eliminar este turno?'))) return;
    void deleteDuty(id).catch(() => {
      toast.error('No se pudo eliminar el turno. Inténtalo de nuevo.');
    });
  }

  let content: React.ReactNode;
  if (loading) {
    content = <Spinner />;
  } else if (error) {
    content = <ErrorState message="No se pudieron cargar los turnos" />;
  } else {
    content = (
      <>
        <div className={styles.subsection}>
          <h3 className={styles.subheading}>
            {editingDuty ? 'Editar turno' : 'Asignar turno'}
          </h3>
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
              <DutyFormContent
                units={units ?? []}
                disabled={saving}
                submitLabel={editingDuty ? 'Guardar cambios' : 'Asignar turno'}
                onCancel={editingDuty ? () => setEditingDuty(null) : undefined}
              />
            </form>
          </FormProvider>
        </div>
        <div className={styles.subsection}>
          <h3 className={styles.subheading}>Turnos asignados</h3>
          {!duties?.length ? (
            <EmptyState message="Todavía no hay turnos asignados a esta ruta" />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Conductor</th>
                  <th>Descripción</th>
                  <th>Hora de partida</th>
                  <th>Hora de llegada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {duties.map((duty) => (
                  <tr
                    key={duty.id}
                    className={
                      duty.id === editingDuty?.id ? styles.editing : undefined
                    }
                  >
                    <td>
                      {duty.unit.name} ({duty.unit.driverName})
                    </td>
                    <td>{duty.description ?? '—'}</td>
                    <td>{duty.startsAt.toLocaleString()}</td>
                    <td>{duty.endsAt.toLocaleString()}</td>
                    <td className={styles.actions}>
                      <Button
                        type="button"
                        onClick={() => setEditingDuty(duty)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleDelete(duty.id)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Turnos de esta ruta</h2>
      {content}
    </section>
  );
}
