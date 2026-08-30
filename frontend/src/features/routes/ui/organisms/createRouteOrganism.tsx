'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { routeFormDefinition, routeDefaultValues, type TRouteForm } from '../../domain/route.form';
import { useCreateRoute } from '../../application/mutations/useCreateRoute.mutation';
import { RouteFormContent } from '../molecules/routeFormContent';
import { routeBuilders } from '@/shared/routes/routes';

export function CreateRouteOrganism() {
  const router = useRouter();
  const { createRoute, loading, error } = useCreateRoute();

  const methods = useForm<TRouteForm>({
    defaultValues: routeDefaultValues(),
    resolver: zodResolver(routeFormDefinition),
  });

  async function onSubmit(data: TRouteForm) {
    if (loading) return;
    const result = await createRoute(data);
    const id = result.data?.createRoute?.id;
    if (id) router.push(routeBuilders.routeDetail(id));
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <RouteFormContent disabled={loading} error={error?.message} submitLabel="Create route" />
      </form>
    </FormProvider>
  );
}
