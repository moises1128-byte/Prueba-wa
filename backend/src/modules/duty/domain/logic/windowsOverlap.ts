/**
 * Pure predicate mirroring the MongoDB `$elemMatch` filter used by
 * UnitRepositoryAdapter.reserveWindow (startsAt < end && endsAt > start). Not called by the
 * create/update duty path itself — that path relies on the atomic DB-level guard for the actual
 * race-safe enforcement (see spec §3) — this function exists as a tested, documented reference of
 * the same semantics, reusable by any future feature that needs to compare windows in plain
 * application code (e.g. a conflict-visualization view).
 */
export function windowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
