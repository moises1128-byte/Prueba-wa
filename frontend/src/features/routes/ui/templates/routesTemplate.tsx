import { CreateRouteOrganism } from '../organisms/createRouteOrganism';
import { RouteListOrganism } from '../organisms/routeListOrganism';
import styles from './routesTemplate.module.css';

export function RoutesTemplate() {
  return (
    <div className={styles.layout}>
      <h1 className={styles.pageTitle}>Rutas</h1>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Nueva ruta</h2>
        <CreateRouteOrganism />
      </section>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Rutas existentes</h2>
        <RouteListOrganism />
      </section>
    </div>
  );
}
