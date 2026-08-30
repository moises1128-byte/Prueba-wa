import { redirect } from 'next/navigation';
import { routeBuilders } from '@/shared/routes/routes';

export default function HomeRoute() {
  redirect(routeBuilders.routes());
}
