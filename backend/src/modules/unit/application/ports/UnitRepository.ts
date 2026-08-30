import type { Unit } from '../../domain/entities/Unit.js';
import type { UnitId } from '../../domain/value-objects/UnitId.js';

export abstract class UnitRepository {
  abstract create(unit: Unit): Promise<Unit>;
  abstract update(id: UnitId, unit: Unit): Promise<Unit | null>;
  abstract delete(id: UnitId): Promise<boolean>;
  abstract findById(id: UnitId): Promise<Unit | null>;
  abstract findAll(): Promise<Unit[]>;
  /** Atomically records a busy window for this unit if — and only if — it does not overlap any
   * existing window. Returns false on conflict (no write happened). See spec §3. */
  abstract reserveWindow(
    unitId: UnitId,
    dutyId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<boolean>;
  abstract releaseWindow(unitId: UnitId, dutyId: string): Promise<void>;
}
