import { RouteMapOrganism } from '../organisms/routeMapOrganism';
import { EditRouteOrganism } from '../organisms/editRouteOrganism';
import styles from './routeDetailTemplate.module.css';

interface RouteDetailTemplateProps {
  routeId: string;
}

export function RouteDetailTemplate({ routeId }: RouteDetailTemplateProps) {
  return (
    <div className={styles.layout}>
      <RouteMapOrganism routeId={routeId} />
      <EditRouteOrganism routeId={routeId} />
    </div>
  );
}
