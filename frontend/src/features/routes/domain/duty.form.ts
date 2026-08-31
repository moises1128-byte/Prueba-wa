import { z } from 'zod';

export const dutyFormDefinition = z
  .object({
    unitId: z.string().min(1, 'La unidad es obligatoria'),
    startsAt: z.string().min(1, 'La hora de inicio es obligatoria'),
    endsAt: z.string().min(1, 'La hora de fin es obligatoria'),
    description: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endsAt) <= new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La hora de fin debe ser posterior a la de inicio',
        path: ['endsAt'],
      });
    }
  });

export type TDutyForm = z.infer<typeof dutyFormDefinition>;

export function dutyDefaultValues(partial?: {
  unitId?: string;
  startsAt?: string;
  endsAt?: string;
  description?: string;
}): TDutyForm {
  return {
    unitId: partial?.unitId ?? '',
    startsAt: partial?.startsAt ?? '',
    endsAt: partial?.endsAt ?? '',
    description: partial?.description ?? '',
  };
}
