import { EditRouteOrganism } from '../organisms/editRouteOrganism';
import styles from './routeDetailTemplate.module.css';

interface RouteDetailTemplateProps {
  routeId: string;
}

export function RouteDetailTemplate({ routeId }: RouteDetailTemplateProps) {
  return (
    <div className={styles.layout}>
      <EditRouteOrganism routeId={routeId} />
    </div>
  );
}
