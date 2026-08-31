'use client';

import { useRoutes } from '../../application/queries/useRoutes.query';
import { RouteCard } from '../molecules/routeCard';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import styles from './routeListOrganism.module.css';

export function RouteListOrganism() {
  const { data, loading, error } = useRoutes();

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="No se pudieron cargar las rutas" />;
  if (!data?.length) return <EmptyState message="Todavía no hay rutas" />;

  return (
    <div className={styles.list}>
      {data.map((route) => (
        <RouteCard key={route.id} route={route} />
      ))}
    </div>
  );
}
