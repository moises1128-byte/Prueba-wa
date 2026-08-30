const ROUTE_PATHS = {
  ROUTES: '/routes',
  ROUTE_DETAIL: '/routes/[id]',
  UNITS: '/units',
} as const;

export const routeBuilders = {
  routes: () => ROUTE_PATHS.ROUTES,
  routeDetail: (id: string) => `/routes/${id}`,
  units: () => ROUTE_PATHS.UNITS,
} as const;
