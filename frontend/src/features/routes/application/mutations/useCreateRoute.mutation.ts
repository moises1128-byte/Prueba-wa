import { useMutation } from '@apollo/client/react';
import { CREATE_ROUTE_MUTATION, ROUTES_QUERY } from '../../infrastructure/routes.graphql';
import { fromRouteFormInput } from '../../infrastructure/routes.transform';
import type { TRouteForm } from '../../domain/route.form';

interface CreateRouteMutationData {
  createRoute: { id: string };
}

export function useCreateRoute() {
  const [mutate, { loading, error }] = useMutation<CreateRouteMutationData>(CREATE_ROUTE_MUTATION, {
    refetchQueries: [{ query: ROUTES_QUERY }],
  });

  async function createRoute(form: TRouteForm) {
    return mutate({ variables: { input: fromRouteFormInput(form) } });
  }

  return { createRoute, loading, error };
}
