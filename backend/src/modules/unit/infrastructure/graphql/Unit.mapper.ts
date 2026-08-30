import type { Unit } from '../../domain/entities/Unit.js';
import type { UnitType } from './Unit.object-type.js';

export function toUnitType(unit: Unit): UnitType {
  return { id: unit.id.value, name: unit.name, driverName: unit.driverName };
}
