# EV Charging Demo App Requirements

This demo app enables users to **find, book, and manage EV charging sessions**, while admins monitor **sessions, incidents, and operational health**.

## Personas

- **EV Driver (USER)**
  - Goals: find nearby charging, filter for relevant connector/power/price options, optionally place a short hold on a point, start charging, review history and costs.
  - Needs: fast “near me” discovery, clear availability and pricing, simple hold + cancellation.

- **Operations Admin (ADMIN)**
  - Goals: observe latest sessions, detect/triage incidents, view high-level statistics (usage/cost).
  - Needs: timely incident visibility (esp. offline/broken points), drill-down into recent sessions and affected points.

- **Telemetry System (Automated actor)**
  - Goals: emit session telemetry and diagnostics; drive active session updates and booking expiry handling.
  - Needs: reliable ingest + retention.

## Customer stories

### View 1 — Map + Search + Station details + Booking (USER priority)

- **Nearby stations**
  - As an EV Driver, I want to open the app and immediately see a map of nearby charging stations so that I can quickly choose where to charge.
  - As an EV Driver, I want each station bubble to show **available charging points** (not in maintenance, not reserved) so that I can avoid wasted trips.

- **Search & filters**
  - As an EV Driver, I want place search plus filters (connector type, power, price) so that I can find stations that match my location and preferences.

- **Station detail**
  - As an EV Driver, I want clicking a station to open a detail view (status, price, connectors, power) so that I can decide confidently select a charging point to reserve.

- **Book a charging point**
  - As an EV Driver, I want to select a specific charging point and create a **short hold (≤ 30 minutes)** so that I can walk to the bay without losing it.
  - As an EV Driver, I want a hold to **auto-cancel when it expires** if I haven’t started charging so that points don’t stay reserved indefinitely.
  - As an EV Driver, I want the system to prevent multiple simultaneous holds/charging on the same charging point so that reservations are reliable.
  - As an EV Driver, I want a hold to appear as a session in `BOOKED` status so that I can manage it consistently with active/past sessions.

### View 2 — Sessions (history, booked, active) + session details

- **Sessions list**
  - As an EV Driver, I want to see my sessions labeled into **completed**, **active**, and **reserved** so that I can manage what matters now.

- **Session detail**
  - As an EV Driver, I want to open a session and see details (station/point info, timestamps, energy, total price) so that I can understand what happened and what I paid.
  - As an EV Driver, I want to optionally rate a completed session so that I can share feedback on the experience.

- **Cancel booking**
  - As an EV Driver, I want to cancel an active hold so that I can change plans without operator support.

- **Start / stop active**
  - As an EV Driver, I want to start charging from a hold (if present) so that the session transitions to `ACTIVE`.
  - As an EV Driver, I want to stop an active session when supported so that I’m not charged/blocked unnecessarily.

### View 3 — Admin dashboard (ADMIN)

- **Operational overview**
  - As an Operations Admin, I want a dashboard showing latest charging sessions and incidents so that I can monitor system health.
  - As an Operations Admin, I want high-level statistics (e.g., total cost/revenue, utilization trends) so that I can assess performance quickly.

## Telemetry & operational status (cross-cutting)

- **Session diagnostics**
  - During an `ACTIVE` charging session, simulate session telemetry.
  - Telemetry is stored and used for operational monitoring.
