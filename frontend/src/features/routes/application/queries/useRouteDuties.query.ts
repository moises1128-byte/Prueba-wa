import { useQuery } from '@apollo/client/react';
import { ROUTE_DUTIES_QUERY } from '../../infrastructure/duties.graphql';
import { toDutyDomain } from '../../infrastructure/duties.transform';

interface RouteDutiesQueryData {
  route: {
    id: string;
    duties: Array<{
      id: string;
      unitId: string;
      startsAt: string;
      endsAt: string;
      unit: { id: string; name: string; driverName: string };
    }>;
  } | null;
}

export function useRouteDuties(routeId: string) {
  const { data, loading, error } = useQuery<RouteDutiesQueryData>(
    ROUTE_DUTIES_QUERY,
    {
      variables: { routeId },
    },
  );
  return {
    data: data?.route?.duties.map(toDutyDomain),
    loading,
    error,
  };
}
