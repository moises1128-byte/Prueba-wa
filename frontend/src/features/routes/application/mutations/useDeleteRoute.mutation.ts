import { useMutation } from '@apollo/client/react';
import { DELETE_ROUTE_MUTATION, ROUTES_QUERY } from '../../infrastructure/routes.graphql';

export function useDeleteRoute() {
  const [mutate, { loading, error }] = useMutation(DELETE_ROUTE_MUTATION, {
    refetchQueries: [{ query: ROUTES_QUERY }],
  });

  async function deleteRoute(id: string) {
    return mutate({ variables: { id } });
  }

  return { deleteRoute, loading, error };
}
