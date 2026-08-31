import { z } from 'zod';

export const dutyFormDefinition = z
  .object({
    unitId: z.string().min(1, 'Unit is required'),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endsAt) <= new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['endsAt'],
      });
    }
  });

export type TDutyForm = z.infer<typeof dutyFormDefinition>;

export function dutyDefaultValues(partial?: {
  unitId?: string;
  startsAt?: string;
  endsAt?: string;
}): TDutyForm {
  return {
    unitId: partial?.unitId ?? '',
    startsAt: partial?.startsAt ?? '',
    endsAt: partial?.endsAt ?? '',
  };
}
