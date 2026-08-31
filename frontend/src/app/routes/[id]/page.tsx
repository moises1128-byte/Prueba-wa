import { RouteDetailPage } from '@/features/routes/ui/pages/routeDetailPage';

export const metadata = { title: 'Detalle de la ruta' };

export default async function RouteDetailRoute({
  params,
}: PageProps<'/routes/[id]'>) {
  const { id } = await params;
  return <RouteDetailPage routeId={id} />;
}
