import { CreateRouteOrganism } from '../organisms/createRouteOrganism';
import { RouteListOrganism } from '../organisms/routeListOrganism';
import styles from './routesTemplate.module.css';

export function RoutesTemplate() {
  return (
    <div className={styles.layout}>
      <CreateRouteOrganism />
      <RouteListOrganism />
    </div>
  );
}
