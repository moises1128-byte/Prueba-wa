import type { Unit } from '../domain/unit.model';
import type { TUnitForm } from '../domain/unit.form';

interface UnitDto {
  id: string;
  name: string;
  driverName: string;
}

export function toUnitDomain(dto: UnitDto): Unit {
  return { id: dto.id, name: dto.name, driverName: dto.driverName };
}

export function fromUnitFormInput(form: TUnitForm) {
  return { name: form.name, driverName: form.driverName };
}
