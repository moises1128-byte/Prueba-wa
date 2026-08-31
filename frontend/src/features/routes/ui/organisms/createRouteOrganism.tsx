'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  routeFormDefinition,
  routeDefaultValues,
  type TRouteForm,
} from '../../domain/route.form';
import { useCreateRoute } from '../../application/mutations/useCreateRoute.mutation';
import { RouteFormContent } from '../molecules/routeFormContent';
import { routeBuilders } from '@/shared/routes/routes';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';

function createRouteErrorMessage(error: unknown): string {
  if (getGraphQLErrorCode(error) === 'invalidRoutePoint') {
    return 'Uno de los puntos de la ruta no es válido.';
  }
  return 'No se pudo guardar la ruta. Inténtalo de nuevo.';
}

export function CreateRouteOrganism() {
  const router = useRouter();
  const { createRoute, loading } = useCreateRoute();

  const methods = useForm<TRouteForm>({
    defaultValues: routeDefaultValues(),
    resolver: zodResolver(routeFormDefinition),
  });

  // Apollo's `useMutation` rejects on a GraphQL error, and react-hook-form's
  // handleSubmit re-throws whatever the submit handler throws — so the rejection
  // has to be caught here or it escapes as an unhandled rejection. On failure the
  // `await` throws before the navigation line, so we correctly stay on the form.
  async function onSubmit(data: TRouteForm) {
    if (loading) return;
    try {
      const result = await createRoute(data);
      const id = result.data?.createRoute?.id;
      if (id) router.push(routeBuilders.routeDetail(id));
    } catch (error) {
      toast.error(createRouteErrorMessage(error));
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <RouteFormContent disabled={loading} submitLabel="Crear ruta" />
      </form>
    </FormProvider>
  );
}
