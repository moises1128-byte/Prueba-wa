import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';
import { Badge } from '@/shared/ui/atoms/badge';
import type { RouteSummary } from '../../domain/route.model';
import styles from './routeCard.module.css';

interface RouteCardProps {
  route: RouteSummary;
}

export function RouteCard({ route }: RouteCardProps) {
  const isActive = route.dutyCount > 0;
  return (
    <Link href={routeBuilders.routeDetail(route.id)} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{route.name ?? 'Ruta sin nombre'}</span>
        <Badge tone={isActive ? 'success' : 'neutral'}>
          {isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>
      <span className={styles.meta}>
        {route.pointCount} puntos · {route.dutyCount} turnos
      </span>
    </Link>
  );
}
