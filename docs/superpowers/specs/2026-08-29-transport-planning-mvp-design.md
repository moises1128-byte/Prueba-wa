# Transport Planning MVP — Design

Date: 2026-08-29
Status: Approved, ready for implementation planning

## 1. Goal

Build the functional core of a small transport-planning system, per the assessment brief:

- **Routes**: create/edit an ordered list of geographic points.
- **Duties**: assign a route + a unit (vehicle) + an explicit time window to a duty. A unit must
  never have two duties with overlapping windows — including under concurrent creation requests.
- **Views**: a routes list and a route detail view (map + points + duties assigned to that route),
  reflecting all CRUD.
- **Persistence**: MongoDB, not in-memory.

Everything below builds on the stack and conventions already established in `CLAUDE.md` and
`agent_docs/` — NestJS + GraphQL (code-first) + Mongoose on the backend, Next.js + Apollo Client +
CSS Modules + Atomic Design on the frontend, hexagonal architecture on the backend.

Naming convention (confirmed): **all file names, function names, class names, and identifiers are
in English**, regardless of the language used in conversation/UI copy.

## 2. Domain model

Three hexagonal modules: `route`, `unit`, `duty`.

```
Route  { id, name?, points: [{ lat, lng, name? }] }   // array order is the route's point order
Unit   { id, name, driverName }                         // vehicle identifier + assigned driver
Duty   { id, routeId, unitId, startsAt, endsAt }
```

`duty` depends on `route` and `unit` — it injects their exported abstract repositories (the
cross-module pattern already documented in `agent_docs/backend/architecture.md`) to validate that
the referenced route and unit exist before creating/updating a duty.

Domain errors: `RouteNotFoundError`, `UnitNotFoundError`, `InvalidDutyWindowError` (`endsAt <=
startsAt`), `DutyOverlapError`, `DutyNotFoundError`, `RouteHasActiveDutiesError`,
`UnitHasActiveDutiesError`.

## 3. The overlap rule — race-safe by construction

This is the core requirement: "a unit must never have two duties with overlapping windows," and
the spec explicitly asks for the invariant to hold under concurrent requests, not just in the
sequential/happy path.

### Approaches considered

- **(A) Atomic single-document guard on `Unit`, chosen.** Each `Unit` document carries an embedded
  `busyWindows: [{ dutyId, startsAt, endsAt }]` array. Creating a duty does:
  ```js
  Unit.findOneAndUpdate(
    {
      _id: unitId,
      busyWindows: {
        $not: {
          $elemMatch: { startsAt: { $lt: end }, endsAt: { $gt: start } },
        },
      },
    },
    { $push: { busyWindows: { dutyId, startsAt, endsAt } } },
  );
  ```
  A `findOneAndUpdate` is atomic at the storage-engine level — no other write can interleave
  between the overlap check and the push, for that unit. If it returns `null`, there's a conflict
  → throw `DutyOverlapError`. `busyWindows` is a Mongoose-only field on the `Unit` schema — it is
  **not** part of the domain `Unit` entity's public shape (§2) or the GraphQL `Unit` type (§5);
  it's purely an infrastructure mechanism for enforcing the invariant, invisible above the
  `UnitRepositoryAdapter`. Only after this succeeds is the `Duty` document itself inserted
  (using a pre-generated id) for querying/listing. This works on a standalone `mongod` — no
  transactions, no replica set — and the guarantee comes from MongoDB itself, so it holds
  regardless of how many backend instances are running.
- **(B) Multi-document transaction.** Rejected: requires converting the local Mongo into a
  replica set, and even with a transaction, two inserts of _different_ documents don't naturally
  conflict — it would still need the same "touch one shared document" trick as (A), for more
  operational cost and no better guarantee.
- **(C) In-process mutex per unit ID.** Rejected as the primary mechanism: correct only as long as
  exactly one Node process is running. A real transport-planning system's natural failure mode
  (multiple backend instances behind a load balancer) breaks it silently. (A) is no harder to
  implement and doesn't have this ceiling.

### Update / delete

- **Delete a duty**: `$pull` the matching entry from the unit's `busyWindows`, then delete the
  `Duty` document.
- **Update a duty** (window and/or unit changes): atomically `$pull` the old entry (from the old
  unit, if the unit changed), then attempt the same guarded push against the new window/unit. If
  the guarded push fails (conflict), restore the pulled entry so the duty isn't silently dropped.

### Shared overlap predicate

A pure domain function, defined once and unit-tested directly:

```ts
function windowsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
```

This mirrors the comparison used in the Mongo `$elemMatch` filter (`startsAt < end && endsAt >
start`) — documented explicitly so the two stay in sync, and reusable if a future feature needs to
compare windows in application code (e.g. the optional "conflict visualization" bonus).

## 4. Deletion rule for Route / Unit

Deleting a `Route` or `Unit` that has one or more duties referencing it is **rejected** (
`RouteHasActiveDutiesError` / `UnitHasActiveDutiesError`), not cascaded. Duties represent real
assigned work; silently deleting them as a side effect of deleting their route/unit is worse than
requiring the user to remove/reassign the duties first.

## 5. GraphQL API surface

```graphql
type Point {
  lat: Float!
  lng: Float!
  name: String
}

type Route {
  id: ID!
  name: String
  points: [Point!]!
  duties: [Duty!]! # resolved field
}

type Unit {
  id: ID!
  name: String!
  driverName: String!
}

type Duty {
  id: ID!
  routeId: ID!
  unitId: ID!
  startsAt: DateTime! # native scalar from @nestjs/graphql code-first — no extra package
  endsAt: DateTime!
  route: Route! # resolved field
  unit: Unit! # resolved field
}

input PointInput {
  lat: Float!
  lng: Float!
  name: String
}
input CreateRouteInput {
  name: String
  points: [PointInput!]!
}
input UpdateRouteInput {
  name: String
  points: [PointInput!]
}
input CreateUnitInput {
  name: String!
  driverName: String!
}
input UpdateUnitInput {
  name: String
  driverName: String
}
input CreateDutyInput {
  routeId: ID!
  unitId: ID!
  startsAt: DateTime!
  endsAt: DateTime!
}
input UpdateDutyInput {
  routeId: ID
  unitId: ID
  startsAt: DateTime
  endsAt: DateTime
}

type Query {
  routes: [Route!]!
  route(id: ID!): Route
  units: [Unit!]!
  unit(id: ID!): Unit
  duties: [Duty!]!
  duty(id: ID!): Duty
}

type Mutation {
  createRoute(input: CreateRouteInput!): Route!
  updateRoute(id: ID!, input: UpdateRouteInput!): Route!
  deleteRoute(id: ID!): Boolean!

  createUnit(input: CreateUnitInput!): Unit!
  updateUnit(id: ID!, input: UpdateUnitInput!): Unit!
  deleteUnit(id: ID!): Boolean!

  createDuty(input: CreateDutyInput!): Duty!
  updateDuty(id: ID!, input: UpdateDutyInput!): Duty!
  deleteDuty(id: ID!): Boolean!
}
```

## 6. Frontend — pages and flows

Three pages, Atomic Design per `agent_docs/frontend/architecture.md`:

**`/routes`** — routes list

```
RoutesPage → RoutesTemplate
  ├─ RouteListOrganism    (fetches routes; each rendered via a RouteCard molecule: name + point count + duty count)
  └─ CreateRouteOrganism  (form: name + ordered list of point rows — lat/lng/name, add/remove row)
```

**`/routes/[id]`** — route detail (the central view of the exercise)

```
RouteDetailPage → RouteDetailTemplate
  ├─ RouteMapOrganism     (Leaflet + OpenStreetMap, plots the route's points in order)
  ├─ RouteDutiesOrganism  (duties for this route: unit name, driver, window; create/edit/delete)
  └─ EditRouteOrganism    (edit name/points; delete route — blocked if it has duties, per §4)
```

Creating a duty here asks for **unit** (dropdown, since `Unit` has its own CRUD) + start/end. A
`DutyOverlapError` from the backend surfaces as an inline form error (via `extensions.code`, per
`agent_docs/frontend/error-handling.md`) — not a generic toast; it's the rule the whole exercise
is about, so it deserves visible, specific feedback.

**`/units`** — simple CRUD, no detail page (no sub-resources)

```
UnitsPage → UnitsTemplate
  ├─ UnitListOrganism    (table: name, driver, edit/delete)
  └─ CreateUnitOrganism  (form: name + driver name)
```

Route point editing for the MVP core is a plain list of rows (lat/lng/name, add/remove) — not
click-to-place-on-map. That's a reasonable later enhancement, not part of the core.

## 7. Testing plan

**Domain (pure, no Mongo):**

- `windowsOverlap()` — edge cases: touching boundaries, containment, exact match, no overlap.
- `Duty.create()` — rejects `endsAt <= startsAt`.

**Use-cases (mocked repositories):** `CreateDutyUseCase` — route/unit not found, happy path.

**Repository (integration, real test Mongo) — the part that actually matters:**

- Sequential: create a duty, then attempt an overlapping one for the same unit → `DutyOverlapError`;
  a non-overlapping one → succeeds.
- **Concurrency — direct evidence for the assessment's core ask**: fire two overlapping
  `createDuty` calls for the same unit concurrently (`Promise.all`) and assert exactly one
  succeeds and the other fails with `DutyOverlapError`.

## 8. Out of scope for the core (optional, only if time remains)

Per the assessment brief: conflict detection/visualization UI, automated API docs (N/A — GraphQL
introspection + Apollo Sandbox already cover this), real map service integration beyond point
plotting (Leaflet/OSM already satisfies the core requirement), Prisma (Mongoose already serves the
same role).
