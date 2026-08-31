import { useMutation } from '@apollo/client/react';
import {
  UPDATE_UNIT_MUTATION,
  UNITS_QUERY,
} from '../../infrastructure/units.graphql';
import { fromUnitFormInput } from '../../infrastructure/units.transform';
import type { TUnitForm } from '../../domain/unit.form';

export function useUpdateUnit() {
  const [mutate, { loading, error, reset }] = useMutation(
    UPDATE_UNIT_MUTATION,
    {
      refetchQueries: [{ query: UNITS_QUERY }],
    },
  );

  async function updateUnit(id: string, form: TUnitForm) {
    return mutate({ variables: { id, input: fromUnitFormInput(form) } });
  }

  return { updateUnit, loading, error, reset };
}
