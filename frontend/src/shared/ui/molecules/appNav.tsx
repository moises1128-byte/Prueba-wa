import Link from 'next/link';
import { routeBuilders } from '@/shared/routes/routes';
import styles from './appNav.module.css';

export function AppNav() {
  return (
    <nav className={styles.nav}>
      <Link href={routeBuilders.routes()}>Rutas</Link>
      <Link href={routeBuilders.units()}>Unidades</Link>
    </nav>
  );
}
