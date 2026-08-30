import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';
import type { RouteSummary } from '../../domain/route.model';
import styles from './routeCard.module.css';

interface RouteCardProps {
  route: RouteSummary;
}

export function RouteCard({ route }: RouteCardProps) {
  return (
    <Link href={routeBuilders.routeDetail(route.id)} className={styles.card}>
      <span className={styles.name}>{route.name ?? 'Unnamed route'}</span>
      <span className={styles.meta}>
        {route.pointCount} points · {route.dutyCount} duties
      </span>
    </Link>
  );
}
