import { useMutation } from '@apollo/client/react';
import { CREATE_UNIT_MUTATION, UNITS_QUERY } from '../../infrastructure/units.graphql';
import { fromUnitFormInput } from '../../infrastructure/units.transform';
import type { TUnitForm } from '../../domain/unit.form';

export function useCreateUnit() {
  const [mutate, { loading, error }] = useMutation(CREATE_UNIT_MUTATION, {
    refetchQueries: [{ query: UNITS_QUERY }],
  });

  async function createUnit(form: TUnitForm) {
    return mutate({ variables: { input: fromUnitFormInput(form) } });
  }

  return { createUnit, loading, error };
}
