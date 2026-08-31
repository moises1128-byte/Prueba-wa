import type { Duty } from '../domain/duty.model';
import type { TDutyForm } from '../domain/duty.form';
import { fromDatetimeLocalValue } from '../domain/duty.logic';

interface DutyDto {
  id: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  unit: { id: string; name: string; driverName: string };
}

export function toDutyDomain(dto: DutyDto): Duty {
  return {
    id: dto.id,
    unitId: dto.unitId,
    startsAt: new Date(dto.startsAt),
    endsAt: new Date(dto.endsAt),
    unit: dto.unit,
  };
}

export function fromCreateDutyInput(routeId: string, form: TDutyForm) {
  return {
    routeId,
    unitId: form.unitId,
    startsAt: fromDatetimeLocalValue(form.startsAt).toISOString(),
    endsAt: fromDatetimeLocalValue(form.endsAt).toISOString(),
  };
}

export function fromUpdateDutyInput(form: TDutyForm) {
  return {
    unitId: form.unitId,
    startsAt: fromDatetimeLocalValue(form.startsAt).toISOString(),
    endsAt: fromDatetimeLocalValue(form.endsAt).toISOString(),
  };
}
