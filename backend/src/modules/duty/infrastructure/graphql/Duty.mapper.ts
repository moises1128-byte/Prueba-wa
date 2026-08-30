import type { Duty } from '../../domain/entities/Duty.js';
import type { DutyType } from './Duty.object-type.js';

export function toDutyType(duty: Duty): DutyType {
  return {
    id: duty.id.value,
    routeId: duty.routeId.value,
    unitId: duty.unitId.value,
    startsAt: duty.startsAt,
    endsAt: duty.endsAt,
  };
}
