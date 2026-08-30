import { RouteDetailTemplate } from '../templates/routeDetailTemplate';

interface RouteDetailPageProps {
  routeId: string;
}

export function RouteDetailPage({ routeId }: RouteDetailPageProps) {
  return <RouteDetailTemplate routeId={routeId} />;
}
