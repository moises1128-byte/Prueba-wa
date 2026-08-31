export interface DutyUnit {
  readonly id: string;
  readonly name: string;
  readonly driverName: string;
}

export interface Duty {
  readonly id: string;
  readonly unitId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  // Embeds the resolved unit, not just its id: every place this UI renders a
  // duty also needs the unit's name/driver, and the backend's `duty.unit`
  // resolved field already joins it server-side — re-deriving it from a
  // second Unit fetch would be pure duplication for no benefit.
  readonly unit: DutyUnit;
}
