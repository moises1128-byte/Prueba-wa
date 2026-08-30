import type { Duty } from '../../domain/entities/Duty.js';
import type { DutyId } from '../../domain/value-objects/DutyId.js';
import type { RouteId } from '../../../route/domain/value-objects/RouteId.js';
import type { UnitId } from '../../../unit/domain/value-objects/UnitId.js';

export abstract class DutyRepository {
  abstract create(duty: Duty): Promise<Duty>;
  abstract update(id: DutyId, duty: Duty): Promise<Duty | null>;
  abstract delete(id: DutyId): Promise<boolean>;
  abstract findById(id: DutyId): Promise<Duty | null>;
  abstract findAll(): Promise<Duty[]>;
  abstract findByRouteId(routeId: RouteId): Promise<Duty[]>;
  abstract findByUnitId(unitId: UnitId): Promise<Duty[]>;
}
