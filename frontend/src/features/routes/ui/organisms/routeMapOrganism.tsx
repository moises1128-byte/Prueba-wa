'use client';

import dynamic from 'next/dynamic';
import { useRoute } from '../../application/queries/useRoute.query';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';

const RouteLeafletMap = dynamic(
  () => import('./routeLeafletMap').then((mod) => mod.RouteLeafletMap),
  { ssr: false },
);

interface RouteMapOrganismProps {
  routeId: string;
}

export function RouteMapOrganism({ routeId }: RouteMapOrganismProps) {
  const { data: route, loading, error } = useRoute(routeId);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load the map" />;
  if (!route) return <ErrorState message="Route not found" />;
  if (!route.points.length) return <EmptyState message="This route has no points yet" />;

  return <RouteLeafletMap points={route.points} />;
}
