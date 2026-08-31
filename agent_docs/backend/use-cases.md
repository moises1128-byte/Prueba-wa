---
description: Reference for every application-layer use case — inputs, errors thrown, edge cases, and where each rule actually lives
globs: 'backend/src/modules/**/application/use-cases/*.ts'
alwaysApply: false
---

# Use Cases Reference

Every use case in `backend/src/modules/*/application/use-cases/`, what it does, every error it can
throw, and the edge cases it does (and doesn't) handle. This is the source of truth for "is X
covered" questions — if a rule isn't listed here, it isn't enforced at the use-case level.

IDs (`RouteId`, `UnitId`, `DutyId`) are restored from raw strings without format validation
(`restore()` doesn't check UUID shape) — a malformed or nonexistent id simply fails to match any
document in MongoDB, so it surfaces as the entity's `NotFoundError`, not a separate validation
error. This is a deliberate simplification: there's no meaningful difference between "malformed id"
and "id that doesn't exist" from the caller's point of view.

---

## Route module

### CreateRouteUseCase

- **Input:** `{ name?: string; points: { lat, lng, name? }[] }`
- **Throws:** `InvalidRoutePointError` if any point's `lat` is outside `[-90, 90]` or `lng` outside
  `[-180, 180]` (`RoutePoint.create`, checked per point — the first invalid point aborts the whole
  operation, no partial route is created).
- **Notes:** No minimum-points check at this layer — an empty `points` array is accepted by the
  domain entity itself (`Route.create` doesn't validate array length). The **frontend** Zod schema
  requires at least one point, but a raw GraphQL client can bypass that and create a route with zero
  points. `RouteMapOrganism` handles this gracefully (empty state), so it's not a crash — just a
  narrower validation surface than the UI suggests.

### UpdateRouteUseCase

- **Input:** `id: string`, `{ name?: string; points?: { lat, lng, name? }[] }` (both fields
  optional — omitted fields keep their existing value; `points`, if provided, replaces the array in
  full, it doesn't merge point-by-point).
- **Throws:** `RouteNotFoundError` if no route matches `id`; `InvalidRoutePointError` if any new
  point is out of range (same rule as create).
- **Notes:** Double not-found check by construction — once on `findById` before updating, once on
  the `update()` write's return value — covers the (very narrow) case where the route was deleted
  by a concurrent request between the read and the write.

### DeleteRouteUseCase

- **Input:** `id: string`
- **Throws:** `RouteNotFoundError` if no route matches `id`.
- **Notes:** **This use case is duty-unaware on purpose** — it has no idea whether the route has
  duties assigned to it. The actual `deleteRoute` GraphQL mutation is NOT implemented by
  `RouteResolver`; it's implemented by `RouteDutyIntegrationResolver` (in the `duty` module, per the
  one-directional `duty → route` dependency — `route` never imports `duty`), which queries
  `GetDutiesByRouteUseCase` first and throws `RouteHasActiveDutiesError` before ever calling this
  use case if any duties exist. **That check-then-delete sequence is not atomic** — see
  "Concurrency — what's covered and what isn't" below.

### GetRouteByIdUseCase / GetRoutesUseCase

- Plain reads, no business rules. `GetRouteByIdUseCase` returns `null` (not an error) when the route
  doesn't exist — the GraphQL `route` query field is nullable, so this is the correct contract, not
  a gap.

---

## Unit module

### CreateUnitUseCase

- **Input:** `{ name: string; driverName: string }`
- **Throws:** `InvalidUnitError` if `name` or `driverName` is blank after trimming
  (`assertNonBlank` — whitespace-only strings are rejected, not just empty strings).

### UpdateUnitUseCase

- **Input:** `id: string`, `{ name?: string; driverName?: string }`
- **Throws:** `UnitNotFoundError` if no unit matches `id`; `InvalidUnitError` if the resulting
  `name`/`driverName` (existing value if the field was omitted, new value if provided) is blank.
- **Notes:** Same double not-found check pattern as `UpdateRouteUseCase`.

### DeleteUnitUseCase

- **Input:** `id: string`
- **Throws:** `UnitNotFoundError` if no unit matches `id`.
- **Notes:** Duty-unaware, same reasoning as `DeleteRouteUseCase` — the real `deleteUnit` mutation
  lives in `UnitDutyIntegrationResolver` (duty module), which checks `GetDutiesByUnitUseCase` first
  and throws `UnitHasActiveDutiesError` before calling this use case. Same non-atomic
  check-then-delete caveat applies.

### GetUnitByIdUseCase / GetUnitsUseCase

- Plain reads. `GetUnitByIdUseCase` returns `null` for a missing unit (nullable GraphQL field, not
  a gap).

---

## Duty module

This is where almost all of the real business logic — and all of the concurrency-hardening — lives.

### CreateDutyUseCase

- **Input:** `{ routeId: string; unitId: string; startsAt: Date; endsAt: Date }`
- **Throws:**
  - `RouteNotFoundError` if `routeId` doesn't match an existing route.
  - `UnitNotFoundError` if `unitId` doesn't match an existing unit.
  - `InvalidDutyWindowError` if `endsAt <= startsAt` (`Duty.create`).
  - `DutyOverlapError` if the atomic reservation on the unit's `busyWindows` fails because the
    window conflicts with one already held by that unit — **this is the concurrency-safe check**;
    see below.
- **Order of operations:** validate route exists → validate unit exists → validate window shape →
  atomically reserve the window on the unit (`UnitRepository.reserveWindow`) → persist the `Duty`
  document. If the persist step throws (e.g. a transient DB error) **after** the reservation
  succeeded, the use case releases the reservation it just took (best-effort — a failure to release
  is swallowed, and the original persistence error is what the caller sees, not the rollback
  failure) before re-throwing. Without this, a failed create could leave the unit permanently
  "blocked" for a window that has no corresponding `Duty` document anywhere.
- **Concurrency:** `reserveWindow` is a single atomic `findOneAndUpdate` on the `Unit` document —
  see `agent_docs/backend/architecture.md`'s "atomic overlap guard" section for the exact query and
  why it's race-safe under concurrent calls. This is the one invariant in the whole system proven
  correct under real concurrent load (5 simultaneous `createDuty` calls for the same unit, at both
  the repository level and the full HTTP/GraphQL level).

### UpdateDutyUseCase

The most edge-case-heavy use case in the codebase. **Input:** `id: string`,
`{ routeId?: string; unitId?: string; startsAt?: Date; endsAt?: Date }` (all fields optional —
omitted fields keep their current value).

- **Throws:**
  - `DutyNotFoundError` if no duty matches `id`.
  - `RouteNotFoundError` / `UnitNotFoundError` — only checked when `routeId`/`unitId` is actually
    being changed (an update that doesn't touch `routeId` never re-validates the existing route).
  - `InvalidDutyWindowError` if the resulting window is invalid.
  - `DutyOverlapError` if the new window/unit conflicts with another duty already held by that unit.
  - `DutyReservationLostError` — a narrow failure inside a failure: if the new reservation is
    rejected as a conflict AND the attempt to revert to the original window _also_ fails, the duty
    is left with an inconsistent reservation. Rather than silently swallowing that, it's surfaced as
    its own error so the caller knows a retry is needed instead of assuming the old window still
    holds.
- **The no-op short-circuit:** if the update doesn't actually change the unit or the time window
  (e.g. only `routeId` changes), the release/reserve dance is skipped entirely. This isn't just an
  optimization — releasing and re-reserving the _same_ window, even for a moment, would open a race
  window where a concurrent `createDuty` for that unit could grab the slot in between.
- **Rollback, two layers deep:**
  1. If the new reservation fails (conflict), it attempts to restore the old window
     (`reserveWindow` with the original values). If that succeeds, the caller sees
     `DutyOverlapError` — nothing changed from their perspective. If the restore itself fails, the
     caller sees `DutyReservationLostError` instead.
  2. Separately, once the reservation step (new window) has succeeded, persisting the actual `Duty`
     document update is wrapped in its own try/catch: if that write fails, it releases the
     newly-reserved window and re-reserves the original one (best-effort, original error wins on
     re-throw) — symmetric to `CreateDutyUseCase`'s rollback, for the same reason.
- **Concurrency:** covered by the same atomic `reserveWindow`/`releaseWindow` primitives as create.
  Not covered: two people editing the _same_ duty concurrently (e.g. both changing only the notes/
  routeId, not the window) — there's no optimistic-concurrency check (version/timestamp), so it's
  last-write-wins with no conflict signal to either caller.

### DeleteDutyUseCase

- **Input:** `id: string`
- **Throws:** `DutyNotFoundError` if no duty matches `id`.
- **Order of operations:** delete the `Duty` document **first**, then release its window reservation
  on the unit. **This ordering matters for the failure case**: if the release step fails after the
  delete already succeeded, the `Duty` document is gone (so it won't show up anywhere in the UI) but
  the unit's `busyWindows` still holds the reservation — that slot stays permanently blocked on that
  unit for a duty that no longer exists, since nothing else ever cleans up an orphaned
  `busyWindows` entry. There's no rollback or retry around this specific failure; it's a known,
  narrow gap (see the README's "Concurrencia y casos borde" section), not a silently-accepted bug.

### GetDutyByIdUseCase / GetDutiesUseCase / GetDutiesByRouteUseCase / GetDutiesByUnitUseCase

- Plain reads, no business rules. `GetDutyByIdUseCase` returns `null` for a missing duty (nullable
  GraphQL field). The other three back the `duties` query, the `Route.duties` resolved field, and
  the active-duties check both `*DutyIntegrationResolver`s use before allowing a delete.

---

## Concurrency — what's covered and what isn't

Only one invariant in this system is hardened with an atomic, storage-engine-level guarantee: **a
unit can never hold two duties with overlapping windows**, enforced by the single-document
`findOneAndUpdate` described in `agent_docs/backend/architecture.md`. Everything else above is
standard sequential use-case validation — correct for the non-adversarial case, but without the
same protection against a request landing in the exact middle of another one. Concretely:

- `RouteHasActiveDutiesError` / `UnitHasActiveDutiesError` (the delete-blocking checks) are a
  **check-then-act** in `RouteDutyIntegrationResolver`/`UnitDutyIntegrationResolver`, not an atomic
  guard. A `createDuty` for a route/unit that lands between the "any duties?" check and the actual
  delete could result in the route/unit being deleted anyway, leaving that duty pointing at nothing.
- No optimistic concurrency control anywhere (`UpdateRouteUseCase`, `UpdateUnitUseCase`,
  `UpdateDutyUseCase` for non-window fields) — concurrent edits to the same record are last-write-
  wins, with no version check and no conflict error surfaced to either caller.
- `DeleteDutyUseCase`'s two-step delete-then-release isn't atomic across the two writes — see its
  section above.

None of these were given the same treatment as the overlap guard because they weren't the specific
requirement this exercise asked to prove under concurrency. They're documented here so the gap is a
known, explicit decision — not something to be discovered later.
