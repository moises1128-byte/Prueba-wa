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
  if (error) return <ErrorState message="No se pudo cargar el mapa" />;
  if (!route) return <ErrorState message="Ruta no encontrada" />;
  if (!route.points.length)
    return <EmptyState message="Esta ruta todavía no tiene puntos" />;

  return <RouteLeafletMap points={route.points} />;
}
