import { useMutation } from '@apollo/client/react';
import {
  DELETE_DUTY_MUTATION,
  ROUTE_DUTIES_QUERY,
} from '../../infrastructure/duties.graphql';
import { ROUTES_QUERY } from '../../infrastructure/routes.graphql';

export function useDeleteDuty(routeId: string) {
  const [mutate, { loading, error }] = useMutation(DELETE_DUTY_MUTATION, {
    refetchQueries: [
      { query: ROUTE_DUTIES_QUERY, variables: { routeId } },
      { query: ROUTES_QUERY },
    ],
  });

  async function deleteDuty(id: string) {
    return mutate({ variables: { id } });
  }

  return { deleteDuty, loading, error };
}
