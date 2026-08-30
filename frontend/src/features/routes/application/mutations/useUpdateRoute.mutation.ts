import { useMutation } from '@apollo/client/react';
import { UPDATE_ROUTE_MUTATION, ROUTES_QUERY, ROUTE_QUERY } from '../../infrastructure/routes.graphql';
import { fromRouteFormInput } from '../../infrastructure/routes.transform';
import type { TRouteForm } from '../../domain/route.form';

export function useUpdateRoute() {
  const [mutate, { loading, error }] = useMutation(UPDATE_ROUTE_MUTATION);

  async function updateRoute(id: string, form: TRouteForm) {
    return mutate({
      variables: { id, input: fromRouteFormInput(form) },
      refetchQueries: [{ query: ROUTE_QUERY, variables: { id } }, { query: ROUTES_QUERY }],
    });
  }

  return { updateRoute, loading, error };
}
