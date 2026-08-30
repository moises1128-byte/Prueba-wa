import { z } from 'zod';

export const routePointFormDefinition = z.object({
  lat: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  name: z.string().optional(),
});

export const routeFormDefinition = z.object({
  name: z.string().optional(),
  points: z.array(routePointFormDefinition).min(1, 'At least one point is required'),
});

export type TRouteForm = z.infer<typeof routeFormDefinition>;

export function routeDefaultValues(partial?: Partial<TRouteForm>): TRouteForm {
  return {
    name: partial?.name ?? '',
    points: partial?.points ?? [{ lat: 0, lng: 0, name: '' }],
  };
}
