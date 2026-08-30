import { useQuery } from '@apollo/client/react';
import { ROUTE_QUERY } from '../../infrastructure/routes.graphql';
import { toRouteDomain } from '../../infrastructure/routes.transform';
import type { Route } from '../../domain/route.model';

interface RouteQueryData {
  route: {
    id: string;
    name: string | null;
    points: Array<{ lat: number; lng: number; name: string | null }>;
  } | null;
}

export function useRoute(id: string) {
  const { data, loading, error } = useQuery<RouteQueryData>(ROUTE_QUERY, {
    variables: { id },
  });
  return {
    data: data ? ((data.route ? toRouteDomain(data.route) : null) as Route | null) : undefined,
    loading,
    error,
  };
}
