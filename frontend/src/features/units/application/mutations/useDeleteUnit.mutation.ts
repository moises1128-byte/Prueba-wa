import { useMutation } from '@apollo/client/react';
import {
  DELETE_UNIT_MUTATION,
  UNITS_QUERY,
} from '../../infrastructure/units.graphql';

export function useDeleteUnit() {
  const [mutate, { loading, error }] = useMutation(DELETE_UNIT_MUTATION, {
    refetchQueries: [{ query: UNITS_QUERY }],
  });

  async function deleteUnit(id: string) {
    return mutate({ variables: { id } });
  }

  return { deleteUnit, loading, error };
}
