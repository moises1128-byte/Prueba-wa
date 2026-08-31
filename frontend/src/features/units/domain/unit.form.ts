import { z } from 'zod';

export const unitFormDefinition = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  driverName: z
    .string()
    .min(1, 'El nombre del conductor es obligatorio')
    .max(100),
});

export type TUnitForm = z.infer<typeof unitFormDefinition>;

export function unitDefaultValues(partial?: Partial<TUnitForm>): TUnitForm {
  return {
    name: partial?.name ?? '',
    driverName: partial?.driverName ?? '',
  };
}
