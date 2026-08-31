import { useMutation } from '@apollo/client/react';
import { CREATE_DUTY_MUTATION, ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { ROUTES_QUERY } from '../../infrastructure/routes.graphql';
import { fromCreateDutyInput } from '../../infrastructure/duties.transform';
import type { TDutyForm } from '../../domain/duty.form';

export function useCreateDuty(routeId: string) {
  const [mutate, { loading, error }] = useMutation(CREATE_DUTY_MUTATION, {
    refetchQueries: [{ query: ROUTE_DUTIES_QUERY, variables: { routeId } }, { query: ROUTES_QUERY }],
  });

  async function createDuty(form: TDutyForm) {
    return mutate({ variables: { input: fromCreateDutyInput(routeId, form) } });
  }

  return { createDuty, loading, error };
}
