'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { routeFormDefinition, routeDefaultValues, type TRouteForm } from '../../domain/route.form';
import { useRoute } from '../../application/queries/useRoute.query';
import { useUpdateRoute } from '../../application/mutations/useUpdateRoute.mutation';
import { useDeleteRoute } from '../../application/mutations/useDeleteRoute.mutation';
import { RouteFormContent } from '../molecules/routeFormContent';
import { Button } from '@/shared/ui/atoms/button';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import { routeBuilders } from '@/shared/routes/routes';
import styles from './editRouteOrganism.module.css';

interface EditRouteOrganismProps {
  routeId: string;
}

export function EditRouteOrganism({ routeId }: EditRouteOrganismProps) {
  const router = useRouter();
  const { data: route, loading, error } = useRoute(routeId);
  const { updateRoute, loading: updating, error: updateError } = useUpdateRoute();
  const { deleteRoute, loading: deleting, error: deleteError } = useDeleteRoute();

  const methods = useForm<TRouteForm>({
    values: route
      ? routeDefaultValues({
          name: route.name ?? undefined,
          points: route.points.map((p) => ({ lat: p.lat, lng: p.lng, name: p.name ?? undefined })),
        })
      : undefined,
    resolver: zodResolver(routeFormDefinition),
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load this route" />;
  if (!route) return <ErrorState message="Route not found" />;

  async function onSubmit(data: TRouteForm) {
    if (updating) return;
    await updateRoute(routeId, data);
  }

  function handleDelete() {
    if (deleting) return;
    if (!window.confirm('Delete this route?')) return;
    void deleteRoute(routeId).then(() => router.push(routeBuilders.routes()));
  }

  const deleteErrorMessage =
    getGraphQLErrorCode(deleteError) === 'routeHasActiveDuties'
      ? 'This route has duties assigned. Remove them before deleting the route.'
      : deleteError
        ? 'Failed to delete route. Please try again.'
        : undefined;

  return (
    <div>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)}>
          <RouteFormContent disabled={updating} error={updateError?.message} submitLabel="Save changes" />
        </form>
      </FormProvider>
      <Button type="button" disabled={deleting} onClick={handleDelete} className={styles.deleteButton}>
        Delete route
      </Button>
      {deleteErrorMessage ? <ErrorState message={deleteErrorMessage} /> : null}
    </div>
  );
}
