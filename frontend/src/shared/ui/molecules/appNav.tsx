import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';
import styles from './appNav.module.css';

export function AppNav() {
  return (
    <nav className={styles.nav}>
      <Link href={routeBuilders.routes()}>Routes</Link>
      <Link href={routeBuilders.units()}>Units</Link>
    </nav>
  );
}
