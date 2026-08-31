import { useMutation } from '@apollo/client/react';
import { UPDATE_DUTY_MUTATION, ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { fromUpdateDutyInput } from '../../infrastructure/duties.transform';
import type { TDutyForm } from '../../domain/duty.form';

export function useUpdateDuty(routeId: string) {
  const [mutate, { loading, error }] = useMutation(UPDATE_DUTY_MUTATION, {
    refetchQueries: [{ query: ROUTE_DUTIES_QUERY, variables: { routeId } }],
  });

  async function updateDuty(id: string, form: TDutyForm) {
    return mutate({ variables: { id, input: fromUpdateDutyInput(form) } });
  }

  return { updateDuty, loading, error };
}
