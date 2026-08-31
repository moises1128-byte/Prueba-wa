'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRoute } from '../../application/queries/useRoute.query';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import styles from './routeMapOrganism.module.css';

const RouteLeafletMap = dynamic(
  () => import('./routeLeafletMap').then((mod) => mod.RouteLeafletMap),
  { ssr: false },
);

interface RouteMapOrganismProps {
  routeId: string;
}

export function RouteMapOrganism({ routeId }: RouteMapOrganismProps) {
  const { data: route, loading, error } = useRoute(routeId);

  let content: ReactNode;
  if (loading) {
    content = <Spinner />;
  } else if (error) {
    content = <ErrorState message="No se pudo cargar el mapa" />;
  } else if (!route) {
    content = <ErrorState message="Ruta no encontrada" />;
  } else if (!route.points.length) {
    content = <EmptyState message="Esta ruta todavía no tiene puntos" />;
  } else {
    content = <RouteLeafletMap points={route.points} />;
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Mapa de la ruta</h2>
      {content}
    </section>
  );
}
