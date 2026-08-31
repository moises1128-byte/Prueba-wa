'use client';

import type { ReactNode } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  routeFormDefinition,
  routeDefaultValues,
  type TRouteForm,
} from '../../domain/route.form';
import { useRoute } from '../../application/queries/useRoute.query';
import { useUpdateRoute } from '../../application/mutations/useUpdateRoute.mutation';
import { useDeleteRoute } from '../../application/mutations/useDeleteRoute.mutation';
import { RouteFormContent } from '../molecules/routeFormContent';
import { Button } from '@/shared/ui/atoms/button';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import { useConfirm } from '@/context/confirmDialogProvider';
import { routeBuilders } from '@/shared/routes/routes';
import styles from './editRouteOrganism.module.css';

interface EditRouteOrganismProps {
  routeId: string;
}

function updateRouteErrorMessage(error: unknown): string {
  if (getGraphQLErrorCode(error) === 'invalidRoutePoint') {
    return 'Uno de los puntos de la ruta no es válido.';
  }
  return 'No se pudo guardar la ruta. Inténtalo de nuevo.';
}

function deleteRouteErrorMessage(error: unknown): string {
  if (getGraphQLErrorCode(error) === 'routeHasActiveDuties') {
    return 'Esta ruta tiene duties asignados. Quítalos antes de eliminar la ruta.';
  }
  return 'No se pudo eliminar la ruta. Inténtalo de nuevo.';
}

export function EditRouteOrganism({ routeId }: EditRouteOrganismProps) {
  const router = useRouter();
  const { data: route, loading, error } = useRoute(routeId);
  const { updateRoute, loading: updating } = useUpdateRoute();
  const { deleteRoute, loading: deleting } = useDeleteRoute();
  const confirm = useConfirm();

  const methods = useForm<TRouteForm>({
    values: route
      ? routeDefaultValues({
          name: route.name ?? undefined,
          points: route.points.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            name: p.name ?? undefined,
          })),
        })
      : undefined,
    resolver: zodResolver(routeFormDefinition),
  });

  // Apollo's `useMutation` rejects on a GraphQL error, and react-hook-form's
  // handleSubmit re-throws whatever the submit handler throws — so the rejection
  // has to be caught here or it escapes as an unhandled rejection. Catching it
  // also means the form keeps the user's input on failure.
  async function onSubmit(data: TRouteForm) {
    if (updating) return;
    try {
      await updateRoute(routeId, data);
    } catch (updateError) {
      toast.error(updateRouteErrorMessage(updateError));
    }
  }

  async function handleDelete() {
    if (deleting) return;
    if (!(await confirm('¿Eliminar esta ruta?'))) return;
    void deleteRoute(routeId)
      .then(() => router.push(routeBuilders.routes()))
      .catch((deleteError: unknown) => {
        toast.error(deleteRouteErrorMessage(deleteError));
      });
  }

  let content: ReactNode;
  if (loading) {
    content = <Spinner />;
  } else if (error) {
    content = <ErrorState message="No se pudo cargar esta ruta" />;
  } else if (!route) {
    content = <ErrorState message="Ruta no encontrada" />;
  } else {
    content = (
      <>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <RouteFormContent
              disabled={updating}
              submitLabel="Guardar cambios"
            />
          </form>
        </FormProvider>
        <Button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className={styles.deleteButton}
        >
          Eliminar ruta
        </Button>
      </>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>
        Editar ruta{route?.name ? `: ${route.name}` : ''}
      </h2>
      {content}
    </section>
  );
}
