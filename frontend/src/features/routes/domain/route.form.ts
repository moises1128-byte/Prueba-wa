import { z } from 'zod';

export const routePointFormDefinition = z.object({
  lat: z
    .number()
    .min(-90, 'La latitud debe estar entre -90 y 90')
    .max(90, 'La latitud debe estar entre -90 y 90'),
  lng: z
    .number()
    .min(-180, 'La longitud debe estar entre -180 y 180')
    .max(180, 'La longitud debe estar entre -180 y 180'),
  name: z.string().optional(),
});

export const routeFormDefinition = z.object({
  name: z.string().optional(),
  points: z
    .array(routePointFormDefinition)
    .min(1, 'Se requiere al menos un punto'),
});

export type TRouteForm = z.infer<typeof routeFormDefinition>;

export function routeDefaultValues(partial?: Partial<TRouteForm>): TRouteForm {
  return {
    name: partial?.name ?? '',
    points: partial?.points ?? [{ lat: 0, lng: 0, name: '' }],
  };
}
