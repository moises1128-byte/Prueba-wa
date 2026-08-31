'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  routeFormDefinition,
  routeDefaultValues,
  type TRouteForm,
} from '../../domain/route.form';
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

  // A failed mutation is already reported through the hook's `error` state, which
  // drives the inline message below. Apollo still rejects the promise, and
  // react-hook-form re-throws whatever the submit handler throws, so the rejection
  // has to be absorbed here or it escapes as an unhandled rejection. On failure the
  // `await` throws before the navigation line, so we correctly stay on the form.
  async function onSubmit(data: TRouteForm) {
    if (loading) return;
    try {
      const result = await createRoute(data);
      const id = result.data?.createRoute?.id;
      if (id) router.push(routeBuilders.routeDetail(id));
    } catch {
      // Rendered from `error` below — nothing to do here.
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <RouteFormContent
          disabled={loading}
          error={error?.message}
          submitLabel="Create route"
        />
      </form>
    </FormProvider>
  );
}
