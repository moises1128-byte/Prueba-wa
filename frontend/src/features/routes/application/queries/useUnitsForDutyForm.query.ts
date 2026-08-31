import { useQuery } from '@apollo/client/react';
import { UNITS_FOR_DUTY_FORM_QUERY } from '../../infrastructure/duties.graphql';

interface UnitsForDutyFormData {
  units: Array<{ id: string; name: string; driverName: string }>;
}

export function useUnitsForDutyForm() {
  const { data, loading, error } = useQuery<UnitsForDutyFormData>(UNITS_FOR_DUTY_FORM_QUERY);
  return { data: data?.units, loading, error };
}
