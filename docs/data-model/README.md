# MongoDB Schema Design — EV Charging Stations (Demo App)

This document proposes a MongoDB document schema for an EV Charging Stations demo application.

**Golden rule**: data that is accessed together should be stored together.

---

## 0. Assumptions (to make the demo realistic)

- **Station scale**: ~100–10,000 charging stations; each station has ~2–40 charging points (EVSEs).
- **Telemetry**:
  - Each charging point emits heartbeats even when idle (unless broken).
  - During an active charging session, telemetry is higher-frequency and includes diagnostics.
  - If a point has **no heartbeat** for a threshold (e.g., 2–5 minutes), it transitions to **BROKEN/OFFLINE**.
- **Booking**:
  - Most sessions start without any booking.
  - If a user “books”, it is a **short hold (≤ 30 minutes)** represented as a session with `status: "BOOKED"`.
  - A hold automatically expires at `booking.expiresAt` if charging hasn’t started.
  - A charging point cannot be held/used by multiple sessions at the same time (conflict check against `ACTIVE` sessions and unexpired `BOOKED` holds).
- **Money**: store currency as ISO 4217 string (e.g., `"EUR"`), store monetary values as **integer minor units** (e.g., cents) to avoid float rounding.
- **IDs**:
  - Use **MongoDB `ObjectId`** for `_id` by default (realistic best practice and efficient).
  - Keep **domain/external identifiers** (human-readable station codes, EVSE IDs, etc.) in separate fields with **unique indexes**:
    - `chargingStations.stationCode` (e.g., `"station-001"`, matches the existing simulator payload)
    - `chargingPoints.chargingPointCode` (e.g., `"cp_station-001_01"`) and/or `chargingPoints.evseId` (industry ID)
  - Application/API references should generally use `ObjectId` relationships (`userId`, `stationId`, `chargingPointId`, ...), while still allowing lookups by `stationCode` / `evseId` when integrating with external systems.

---

## 1. Understand the workload

### 1.1 Entities (from the use case)

- User
- Vehicle
- ChargingStation (parent of ChargingPoint)
- ChargingPoint (EVSE)
- ChargingSession (holds + active + completed)
- Incident
- Telemetry (needed for monitoring and “broken if no heartbeat”)

### 1.2 Approximate quantities (order-of-magnitude)

- **users**: 10k–1M (demo: 100–5k)
- **vehicles**: ~1–3 per user (demo: 1–2)
- **chargingStations**: 100–10k (demo: 3–50)
- **chargingPoints**: 1k–200k (demo: 10–300)
- **chargingSessions**: grows unbounded over time (demo: 1k–100k)
- **incidents**: unbounded over time (demo: 10–10k)
- **telemetry**: high volume; unbounded without retention (demo: every 2s–10s per point)

### 1.3 Core operations (reads/writes)

| View / Feature            | Entities                           | Operation                                                                      | Type  | Notes                                        |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | ----- | -------------------------------------------- |
| Map “stations near me”    | ChargingStation                    | Find nearby stations + show available point count                              | Read  | Must be fast; geospatial query               |
| Station detail side panel | Station + Points                   | Load station details + list charging points (status, power, connectors, price) | Read  | Typically 1 station at a time                |
| Search stations           | Station (+ computed availability)  | Free-text + filters (connector type, AC/DC, availability, price)               | Read  | Text search; may accept slightly slower      |
| Book a point              | Session (+ Point computed fields)  | Create short hold (≤ 30 min); prevent conflicts                                | Write | Needs conflict check                         |
| Sessions list             | Session                            | List user’s sessions (past, active, holds)                                     | Read  | Sort by time; paginate                       |
| Session detail            | Session (+ station/point snapshot) | Show details without join                                                      | Read  | Prefer 1 read                                |
| Cancel booking            | Session                            | Cancel hold (`BOOKED` → `CANCELED`)                                            | Write | Update computed “next reservation” fields    |
| Start charging            | Session + Point                    | Transition `BOOKED` → `ACTIVE`; attach telemetry context                       | Write |                                              |
| Admin dashboard           | Session + Incident (+ rollups)     | Latest sessions/incidents + cost stats                                         | Read  | Can use rollups                              |
| Telemetry ingest          | Telemetry + Point                  | Insert telemetry; update “last heartbeat”, point status                        | Write | High rate; use time-series + computed latest |

---

## 2. Relationships and embed vs reference decisions

### 2.1 ChargingStation → ChargingPoint (1:N)

- **Access**: station detail needs many points; map view needs only counts, not full points.
- **Cardinality**: N can be 2–40 (bounded-ish) but **point status changes frequently** due to telemetry.
- **Decision**: **Reference** points in their own collection (`chargingPoints`) to avoid rewriting a station doc at telemetry frequency.
  - Store **computed counts** on the station doc for the map bubble (Computed Pattern).

### 2.2 User → Vehicle (1:N)

- **Access**: typically user profile/preferences with vehicles; sessions also need vehicle info.
- **Cardinality**: small and bounded for most users, but sessions need stable snapshot.
- **Decision**: **Reference** vehicles as their own collection (`vehicles`) and keep a **small “vehicle snapshot”** in sessions (Extended Reference) for fast session detail rendering.

### 2.3 ChargingPoint → ChargingSession (1:N over time)

- **Cardinality**: unbounded (sessions accumulate).
- **Decision**: **Reference** sessions in `chargingSessions` (avoid unbounded arrays).

### 2.4 ChargingPoint → Telemetry (1:N, high rate, unbounded)

- **Decision**: **Separate telemetry** collection, ideally a **time-series** collection with **TTL/retention**.

### 2.5 Station/Point/Session → Incidents (1:N)

- **Decision**: `incidents` as its own collection (unbounded); keep optional “last incident summary” on station/point if needed for quick UI badges (Extended Reference / Computed).

---

## 3. Proposed collections (and their purpose)

- `users`: identities, roles, preferences
- `vehicles`: vehicles owned by users (connector compatibility, max charge power)
- `chargingStations`: location/searchable station metadata + computed availability counts
- `chargingPoints`: EVSE-specific capabilities + operational/availability status
- `chargingSessions`: bookings + active sessions + history, including station/point/vehicle snapshots
- `incidents`: operational issues (auto-detected or user/admin reported)
- `telemetry`: time-series telemetry events for diagnostics/troubleshooting (retained for limited time)
- _(optional)_ `dailyStats`: rollups for admin dashboard (Computed / Roll-Up Pattern)

---

## 4. Document structures (examples)

### 4.1 `users`

```js
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9a111"),
  email: "alex@example.com",
  displayName: "Alex Martin",
  roles: ["USER"], // or ["ADMIN"]

  createdAt: ISODate("2026-02-01T10:00:00Z"),
  lastLoginAt: ISODate("2026-02-12T08:10:00Z"),

  preferences: {
    preferredConnectorTypes: ["CCS", "TYPE2"],
    preferDcFast: true,
    maxPriceCentsPerKwh: 65,
    searchRadiusMeters: 8000
  }
}
```

### 4.2 `vehicles`

```js
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9a222"),
  userId: ObjectId("65c8f2e2d2f4c3a9b3b9a111"),

  vin: "WVWZZZ1JZXW000001",
  make: "Volkswagen",
  model: "ID.4",
  year: 2024,
  batteryCapacityKwh: 77,
  maxChargePowerKw: 135,

  connectorTypes: ["CCS", "TYPE2"],
  createdAt: ISODate("2026-02-01T10:05:00Z")
}
```

### 4.3 `chargingStations`

Station documents are optimized for **map/search/listing** reads:

- geospatial location
- stable metadata
- stable **charging point capability projections** used for search filters (connector type, AC/DC, max kW)
- optionally include a couple of **availability flags** per point (useful for UI search; increases update frequency)
- **computed availability counts** used by the map bubbles

```js
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9b001"),
  stationCode: "station-001",
  name: "Downtown Mall Charging",
  operator: "CityCharge",

  location: { type: "Point", coordinates: [8.5417, 47.3769] }, // [lon, lat]
  address: {
    street: "Main St 10",
    city: "Zurich",
    country: "CH",
    postalCode: "8001"
  },
  timezone: "Europe/Zurich",
  hasFastCharging: true,

  characteristics: {
    parkingType: "PUBLIC", // PUBLIC | PRIVATE | CUSTOMER_ONLY
    amenities: ["MALL", "TOILET", "CAFE"],
    access: {
      open24h: false,
      openingHours: [
        { day: "MON", open: "08:00", close: "22:00" },
        { day: "TUE", open: "08:00", close: "22:00" }
      ]
    }
  },

  pricing: {
    currency: "EUR",
    defaultTariff: {
      priceCentsPerKwh: 55,
      priceCentsPerMinuteIdleAfterMinutes: 20
    }
  },

  // Extended Reference Pattern (search projection):
  // stable per-point capability fields used for station search filters
  // (exclude fast-changing fields like telemetry/status/reservations)
  chargingPoints: [
    {
      chargingPointId: ObjectId("65c8f2e2d2f4c3a9b3b9b101"),
      connectors: [
        { type: "CCS", power: 150, tethered: true },
        { type: "TYPE2", power: 22, tethered: false }
      ],
      // Optional flags (denormalized from chargingPoints.status.*)
      // NOTE: these change more often; include only if it materially improves search UX
      availableNow: false,
      outOfService: false
    }
    // ... one entry per charging point (bounded by station size) ...
  ],

  // Computed Pattern: updated when point statuses change (or periodically)
  availability: {
    totalPoints: 12,
    operationalPoints: 11,          // not BROKEN / OFFLINE
    availableNowPoints: 7,          // operational + not reserved + not charging + not maintenance
    lastComputedAt: ISODate("2026-02-12T08:12:00Z")
  },

  createdAt: ISODate("2026-01-10T09:00:00Z"),
  updatedAt: ISODate("2026-02-12T08:12:00Z")
}
```

### 4.4 `chargingPoints`

Charging points are optimized for the **station detail panel** and operational monitoring.

```js
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9b101"),
  stationId: ObjectId("65c8f2e2d2f4c3a9b3b9b001"),
  chargingPointCode: "cp_station-001_01",
  label: "Bay 1",
  evseId: "DE*CITY*E12345*1",

  connectors: [
    { type: "CCS", current: "DC", power: 150, tethered: true },
    { type: "TYPE2", current: "AC", power: 22, tethered: false }
  ],

  status: {
    operational: "OPERATIONAL",     // OPERATIONAL | MAINTENANCE | BROKEN | OFFLINE
    availability: "AVAILABLE",      // AVAILABLE | RESERVED | CHARGING | OUT_OF_SERVICE
    updatedAt: ISODate("2026-02-12T08:12:00Z")
  },

  // Optional override; else station.pricing.defaultTariff applies
  pricingOverride: null,

  createdAt: ISODate("2026-01-10T09:05:00Z"),
  updatedAt: ISODate("2026-02-12T08:12:00Z")
}
```

### 4.5 `chargingSessions`

Sessions represent **booking holds + active + completed** charging activity.

They include small **extended references** (snapshots) so session list/detail screens can be served without `$lookup`:

- `stationSnapshot`: stable station info for history/receipts (includes `chargingPointLabel`)
- `vehicleSnapshot`: minimal vehicle identifier shown to the user

```js
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9d001"),
  userId: ObjectId("65c8f2e2d2f4c3a9b3b9a111"),
  vehicleId: ObjectId("65c8f2e2d2f4c3a9b3b9a222"),
  stationId: ObjectId("65c8f2e2d2f4c3a9b3b9b001"),
  chargingPointId: ObjectId("65c8f2e2d2f4c3a9b3b9b101"),

  // Extended Reference Pattern (stable snapshot used in UI)
  stationSnapshot: {
    name: "Downtown Mall Charging",
    location: { type: "Point", coordinates: [8.5417, 47.3769] },
    addressShort: "Main St 10, Zurich",
    chargingPointLabel: "Bay 1"
  },
  vehicleSnapshot: {
    vinLast6: "000001",
    make: "BMW"
    model: "i3"
  },

  status: "COMPLETED", // BOOKED | ACTIVE | COMPLETED | CANCELED | NO_SHOW | FAILED

  booking: {
    bookedAt: ISODate("2026-02-12T08:20:00Z"),
    expiresAt: ISODate("2026-02-12T08:50:00Z"), // auto-cancel if not started
    canceledAt: null,
    cancelReason: null
  },

  charging: { // set when charging starts
    startedAt: null,
    endedAt: null,
    connectorUsed: { type: null , power: null, tethered: null },
    meterStartKwh: null, // optional EVSE meter readings (kWh) captured at session start
    meterStopKwh: null, // optional EVSE meter readings (kWh) captured at session end (at session end meterStopKwh = meterStartKwh + energyDeliveredKwh)
    energyDeliveredKwh: null,
    socStartPercent: null,
    socStopPercent: null
  },

  pricingSnapshot: {
    currency: "EUR",
    priceCentsPerKwh: 55,
    idleFee: { priceCentsPerMinute: 20, afterMinutes: 5 }
  },

  cost: {
    totalCents: null,
    energyCents: null,
    idleCents: null
  },

  // Optional post-session feedback (bounded, shown in session details)
  feedback: {
    rating: 5,
    comment: null,
    createdAt: ISODate("2026-02-12T08:20:00Z")
  }

  createdAt: ISODate("2026-02-12T08:20:00Z"),
  updatedAt: ISODate("2026-02-12T08:20:00Z")
}
```

### 4.6 `incidents`

```js
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9e001"),
  createdAt: ISODate("2026-02-12T08:15:00Z"),
  updatedAt: ISODate("2026-02-12T08:18:00Z"),

  type: "NO_HEARTBEAT", // NO_HEARTBEAT | CONNECTOR_FAULT | POWER_DERATE | USER_REPORT | MAINTENANCE
  severity: "HIGH",     // LOW | MEDIUM | HIGH | CRITICAL
  status: "OPEN",       // OPEN | ACKNOWLEDGED | RESOLVED

  stationId: ObjectId("65c8f2e2d2f4c3a9b3b9b001"),
  chargingPointId: ObjectId("65c8f2e2d2f4c3a9b3b9b101"),
  sessionId: null,

  detection: {
    source: "SYSTEM", // SYSTEM | ADMIN | USER
    rule: "heartbeat_missing_180s"
  },

  description: "No heartbeat from charging point for 3 minutes.",
  resolution: {
    resolvedAt: null,
    resolvedByUserId: null,
    notes: null
  }
}
```

### 4.7 `telemetry` (time-series)

This should be implemented as a **time-series** collection with retention (TTL) to keep the dataset bounded.

```js
{
  timestamp: ISODate("2026-02-12T08:11:58Z"),
  meta: {
    stationId: ObjectId("65c8f2e2d2f4c3a9b3b9b001"),
    chargingPointId: ObjectId("65c8f2e2d2f4c3a9b3b9b101"),
    // Optional: helpful for integration/log correlation
    stationCode: "station-001",
    chargingPointCode: "cp_station-001_01",
    evseId: "DE*CITY*E12345*1"
  },

  messageType: "HEARTBEAT", // HEARTBEAT | SAMPLE | SESSION_SAMPLE | FAULT
  ok: true,

  // Example measurements (keep flexible; telemetry evolves)
  powerKw: 0.0,
  energyKwhDelta: 0.0,
  voltageV: 400,
  currentA: 0,
  temperatureC: 31.2,
  errorCodes: []
}
```

---

## 5. Indexing strategy (critical for performance)

Below are recommended indexes. Adjust to actual query patterns and volumes.

### 5.1 `chargingStations`

- **Geo**: nearby stations for map view
- **Text**: free-text search (if not using Atlas Search)
- **Capability filters**: fast filtering by connector type without joining into `chargingPoints`

```js
db.chargingStations.createIndex({ location: "2dsphere" });
db.chargingStations.createIndex({ stationCode: 1 }, { unique: true });
db.chargingStations.createIndex({
  name: "text",
  "address.street": "text",
  "address.city": "text",
});
db.chargingStations.createIndex({ "availability.availableNowPoints": -1 });
db.chargingStations.createIndex({ "chargingPoints.connectors.type": 1 });
db.chargingStations.createIndex({ "chargingPoints.availableNow": 1 });
db.chargingStations.createIndex({ "chargingPoints.outOfService": 1 });
```

### 5.2 `chargingPoints`

- Load points by station quickly
- Filter by operational/availability state and connector types

```js
db.chargingPoints.createIndex({ chargingPointCode: 1 }, { unique: true });
db.chargingPoints.createIndex({ evseId: 1 }, { unique: true, sparse: true });
db.chargingPoints.createIndex({
  stationId: 1,
  "status.operational": 1,
  "status.availability": 1,
});
db.chargingPoints.createIndex({ stationId: 1, "connectors.type": 1 });
db.chargingPoints.createIndex({ stationId: 1, "connectors.power": -1 });
```

### 5.3 `chargingSessions`

- Sessions list for user (history, holds, active)
- Conflict checks for active session / unexpired holds on a point

```js
db.chargingSessions.createIndex({ userId: 1, createdAt: -1 });
db.chargingSessions.createIndex({
  userId: 1,
  status: 1,
  createdAt: -1,
});
db.chargingSessions.createIndex({
  chargingPointId: 1,
  status: 1,
  "booking.expiresAt": 1,
});
```

**Hold conflict check** (conceptual): when creating a hold for a point, search for sessions on the same point where:

- `status == "ACTIVE"`, OR
- `status == "BOOKED"` AND `booking.expiresAt > now` AND `booking.canceledAt == null`

### 5.4 `vehicles`

```js
db.vehicles.createIndex({ userId: 1, createdAt: -1 });
db.vehicles.createIndex({ vin: 1 }, { unique: true, sparse: true });
```

### 5.5 `incidents`

```js
db.incidents.createIndex({ status: 1, createdAt: -1 });
db.incidents.createIndex({ stationId: 1, createdAt: -1 });
db.incidents.createIndex({ chargingPointId: 1, createdAt: -1 });
```

### 5.6 `telemetry` (time-series + TTL)

If using a time-series collection:

- Configure `timeField: "timestamp"`, `metaField: "meta"`
- Configure retention (e.g., 7d–30d) depending on demo needs.

If using a normal collection instead, add:

```js
db.telemetry.createIndex({ "meta.chargingPointId": 1, timestamp: -1 });
db.telemetry.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 14 },
); // 14 days
```

---

## 6. Patterns used (and why)

- **Computed Pattern**:
  - `chargingStations.availability.*` for map bubble counts
- **Extended Reference Pattern**:
  - `chargingSessions.stationSnapshot` and `vehicleSnapshot` so session list/detail doesn’t need `$lookup`
- **Extended Reference Pattern (search projection)**:
  - `chargingStations.chargingPoints[]` to support station search filters that depend on charging point capabilities
- **Avoid unbounded arrays**:
  - No embedded `sessions[]` or `telemetry[]` arrays inside stations/points/users
- **Time-series + retention**:
  - Telemetry is high-rate and must be bounded by TTL/retention for a stable demo
- _(Optional)_ **Roll-up Pattern**:
  - `dailyStats` for admin dashboard summary metrics (revenue, kWh, incident counts)

---

## 6.1 Hybrid search model: station `chargingPoints[]` + separate `chargingPoints` collection

Problem: the search experience mixes **station-level** filters (geo, amenities, operator, opening hours) with **charging point-level** capability filters (connector types, AC/DC, max kW). If you always join station → points at query time, search can become slower/complex as filters grow.

Solution: use the **Extended Reference Pattern** to store a **bounded projection** of charging point fields inside the station document for search (`chargingStations.chargingPoints[]`), while keeping the full `chargingPoints` collection as the source of truth for operational availability and telemetry.

### 6.1.1 What goes into the embedded search projection

Include fields that **don’t change frequently**:

- `connectors[]` with `type`, `power`, `tethered` per connector

Exclude fields that change often:

- `availability` / `operational` status if driven by telemetry (unless you explicitly accept higher update frequency)

### 6.1.2 Document shape

```js
// chargingStations (additional fields)
{
  _id: ObjectId("65c8f2e2d2f4c3a9b3b9b001"),
  stationCode: "station-001",
  // ... station fields (location, amenities, pricing, computed availability counts) ...

  // Extended Reference Pattern: per-point fields for search
  chargingPoints: [
    {
      chargingPointId: ObjectId("65c8f2e2d2f4c3a9b3b9b101"),
      connectors: [
        { type: "CCS", power: 150, tethered: true },
        { type: "TYPE2", power: 22, tethered: false }
      ],
      availableNow: false,
      outOfService: false
    }
    // ... bounded by number of points in this station ...
  ]
}
```

### 6.1.3 Query flow with this model

- **Search**:
  - query `chargingStations` using:
    - `location` (geo)
    - station text/amenities
    - `chargingPoints.connectors.type`, `chargingPoints.connectors.power`
    - optionally `chargingPoints.availableNow` / `chargingPoints.outOfService`
  - return station list + `availability.availableNowPoints` for map bubbles

- **Station details**:
  - load live point state from `chargingPoints.find({ stationId })`
  - sort by `label` / `connectors.power`

### 6.1.4 Keeping `chargingPoints[]` in sync

Because `chargingPoints[]` contains stable capability data, you can keep it correct with low operational burden:

- update `chargingStations.chargingPoints` only when capabilities change (rare)
- periodically reconcile (optional) by rebuilding `chargingPoints[]` from the `chargingPoints` collection (nightly/weekly)
- avoid updating it on telemetry events

## 7. How the schema supports the app’s views

### 7.1 View 1 — Map + Search + Station Detail + Booking

- **Map near me**:
  - query `chargingStations` with `$geoNear` (or `find` with `$nearSphere`) and display `availability.availableNowPoints`.
- **Search**:
  - query `chargingStations` (geo + text + amenities) and apply point-capability filters directly via:
    - `chargingPoints.*`
  - then, when the user opens a station, query `chargingPoints` for live operational state and availability.
- **Station detail**:
  - `chargingStations.findOne({_id})` + `chargingPoints.find({stationId})` sorted by `label` / `connectors.power`.
- **Booking a point**:
  - perform a conflict check in `chargingSessions` against `ACTIVE` sessions and unexpired `BOOKED` holds for the chosen charging point
  - insert a session with `status: "BOOKED"` and `booking.expiresAt = booking.bookedAt + 30 minutes`
  - optionally update station computed availability

### 7.2 View 2 — Sessions (history, booked, active) + details

- **List sessions**: `chargingSessions.find({ userId })` with status/time filters + pagination.
- **Details**: load one `chargingSessions` document; use snapshots to render station/point/vehicle info without joins.
- **Cancel**: update session status to `CANCELED`.

### 7.3 View 3 — Admin

- **Latest sessions**: index on `createdAt` or `updatedAt` descending.
- **Latest incidents**: index on `status + createdAt`.
- **General statistics**:
  - simplest: aggregation on `chargingSessions` (demo-size friendly)
  - scalable: roll up into `dailyStats` via scheduled aggregation job.

---

## 8. Telemetry and “broken if no heartbeat”

### 8.1 Ingest flow (recommended)

On each telemetry insert:

- insert event into `telemetry`
- if message indicates error, set `chargingPoints.status.operational = "BROKEN"` and open an `incidents` record (if not already open)

### 8.2 Heartbeat monitor job (recommended)

Run periodically (e.g., every minute):

- query `telemetry` to find charging points with no recent events (e.g., `max(timestamp) < now - threshold` per point)
- for those points, set `chargingPoints.status.operational = "OFFLINE"` or `"BROKEN"` depending on policy
- open/update `incidents` of type `NO_HEARTBEAT`

This avoids relying on TTL or missing inserts as a detection mechanism.

---

## 9. Schema Validation Strategy

### 9.1 Why enforce schema?

Even in a flexible database like MongoDB, "schema-on-write" is critical for app stability, especially for core entities.

- **Data Integrity**: Prevents "bad data" (e.g., negative prices, missing timestamps, string-as-number) from entering the system.
- **Contract Enforcement**: Ensures the database matches the GraphQL type definitions (e.g., non-nullable fields are actually non-nullable).
- **Bug Detection**: Catches backend logic errors early (e.g., simulator sending strings instead of numbers).

### 9.2 Validation Strategy per Collection

For this demo, we apply validation levels based on the collection's role:

| Collection                           | Strictness                             | Validation Action      | Rationale                                                                                                                                                                                                                                                                                             |
| :----------------------------------- | :------------------------------------- | :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `vehicles`                  | **High**                               | `error`                | Low-volume, structured data. App logic depends heavily on fields like `role` or `connectorTypes`.                                                                                                                                                                                                     |
| `chargingStations`, `chargingPoints` | **High**                               | `error`                | Core inventory. Incorrect coordinates or status enums would break the map/booking UI.                                                                                                                                                                                                                 |
| `chargingSessions`                   | **High**                               | `error`                | Financial/Booking records. Must be strictly validated to prevent billing errors or double bookings.                                                                                                                                                                                                   |
| `incidents`                          | **Medium**                             | `error`                | structured core (type/status) + flexible `description`.                                                                                                                                                                                                                                               |
| `telemetry`                          | **Core Strict** + **Flexible Payload** | `error` on core fields | **Real IoT Strategy**: Enforce core fields (`timestamp`, `stationId`, `messageType`) to ensure routing/indexing works, but allow `additionalProperties: true` for the measurement payload (`powerKw`, `voltageV`) so new sensors or firmware versions can send extra data without breaking ingestion. |

### 9.3 Implementation

We use MongoDB's native JSON Schema validation. The schema definitions are located in `docs/data-model/schemas/*.json` and use BSON types (`int`, `double`, `objectId`, `date`) instead of standard JSON types to match the storage engine.

Example `chargingPoints` validation rule:

```javascript
{
  $jsonSchema: {
    bsonType: "object",
    required: ["status", "connectors"],
    properties: {
      status: {
        bsonType: "object",
        properties: {
          operational: { enum: ["OPERATIONAL", "MAINTENANCE", "BROKEN", "OFFLINE"] }
        }
      }
    }
  }
}
```

---

## 10. Trade-offs & rationale

- **Stations do not embed full points (only a stable search projection)**:
  - Pros: avoids station-doc rewrites at telemetry frequency; `chargingPoints` can update independently while search still supports point-capability filters.
  - Cons: station detail view still requires a second query for live state (acceptable), and capability changes require updating both `chargingPoints` (collection) and the station’s `chargingPoints[]`.
- **Computed station availability counts**:
  - Pros: map view becomes one fast geo query; no aggregation needed.
  - Cons: counts can become slightly stale; mitigate by recomputing on point status transitions or periodic refresh.
- **Sessions store snapshots**:
  - Pros: session list/detail is fast and stable even if station/point names change later.
  - Cons: small duplication; acceptable because these fields are stable and small.
- **Telemetry is separate + retained**:
  - Pros: avoids unbounded growth in “core” collections; enables diagnostics queries.
  - Cons: requires retention settings and (optionally) time-series collection setup.
