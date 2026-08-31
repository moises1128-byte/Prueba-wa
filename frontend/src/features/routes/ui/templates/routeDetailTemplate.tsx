import { RouteMapOrganism } from '../organisms/routeMapOrganism';
import { RouteDutiesOrganism } from '../organisms/routeDutiesOrganism';
import { EditRouteOrganism } from '../organisms/editRouteOrganism';
import styles from './routeDetailTemplate.module.css';

interface RouteDetailTemplateProps {
  routeId: string;
}

export function RouteDetailTemplate({ routeId }: RouteDetailTemplateProps) {
  return (
    <div className={styles.layout}>
      <RouteMapOrganism routeId={routeId} />
      <RouteDutiesOrganism routeId={routeId} />
      <EditRouteOrganism routeId={routeId} />
    </div>
  );
}
