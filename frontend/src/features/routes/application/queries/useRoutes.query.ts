import { useQuery } from '@apollo/client/react';
import { ROUTES_QUERY } from '../../infrastructure/routes.graphql';
import { toRouteSummaryDomain } from '../../infrastructure/routes.transform';

interface RoutesQueryData {
  routes: Array<{
    id: string;
    name: string | null;
    points: Array<{ lat: number; lng: number; name: string | null }>;
    duties: Array<{ id: string }>;
  }>;
}

export function useRoutes() {
  const { data, loading, error } = useQuery<RoutesQueryData>(ROUTES_QUERY);
  return {
    data: data?.routes.map(toRouteSummaryDomain),
    loading,
    error,
  };
}
