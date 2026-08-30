import { z } from 'zod';

export const unitFormDefinition = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  driverName: z.string().min(1, 'Driver name is required').max(100),
});

export type TUnitForm = z.infer<typeof unitFormDefinition>;

export function unitDefaultValues(partial?: Partial<TUnitForm>): TUnitForm {
  return {
    name: partial?.name ?? '',
    driverName: partial?.driverName ?? '',
  };
}
