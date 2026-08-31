import { useQuery } from '@apollo/client/react';
import { UNITS_QUERY } from '../../infrastructure/units.graphql';
import { toUnitDomain } from '../../infrastructure/units.transform';

interface UnitsQueryData {
  units: Array<{ id: string; name: string; driverName: string }>;
}

export function useUnits() {
  const { data, loading, error } = useQuery<UnitsQueryData>(UNITS_QUERY);
  return {
    data: data?.units.map(toUnitDomain),
    loading,
    error,
  };
}
