import asyncio
import hashlib
import logging
import random
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from bson.objectid import ObjectId

from app.config import get_settings
from app.db.mongo import (
    get_charging_points_collection,
    get_charging_sessions_collection,
    get_charging_stations_collection,
    get_telemetry_collection,
)
from app.session_pricing import calculate_booked_idle_cents, resolve_idle_fee

MESSAGE_TYPE_SESSION_SAMPLE = "SESSION_SAMPLE"
MESSAGE_TYPE_FAULT = "FAULT"
FAULT_PROBABILITY = 0.02
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SessionTelemetryContext:
    station_id: ObjectId
    charging_point_id: ObjectId
    station_code: str
    charging_point_code: str
    evse_id: str
    max_kw: float


@dataclass
class SessionSimulationState:
    started_at: datetime
    last_simulated_at: datetime
    meter_start_kwh: float
    cumulative_energy_kwh: float
    soc_start_percent: float
    soc_stop_percent: float
    price_cents_per_kwh: float
    battery_capacity_kwh: float
    vehicle_max_power_kw: float
    booked_idle_cents: int


@dataclass(frozen=True)
class SessionAdvanceResult:
    energy_delta_kwh: float
    power_kw: float
    simulated_until: datetime
    completed_at: datetime | None


def _build_telemetry_doc(
    *,
    timestamp: datetime,
    station_id: ObjectId,
    charging_point_id: ObjectId,
    station_code: str,
    charging_point_code: str,
    evse_id: str,
    message_type: str,
    ok: bool,
    power_kw: float = 0.0,
    energy_kwh_delta: float = 0.0,
    voltage_v: int = 0,
    current_a: int = 0,
    temperature_c: float = 0.0,
    error_codes: list[str] | None = None,
    session_id: ObjectId | None = None,
) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "timestamp": timestamp,
        "meta": {
            "stationId": station_id,
            "chargingPointId": charging_point_id,
            "stationCode": station_code,
            "chargingPointCode": charging_point_code,
            "evseId": evse_id,
        },
        "messageType": message_type,
        "ok": ok,
        "powerKw": round(power_kw, 2),
        "energyKwhDelta": round(energy_kwh_delta, 3),
        "voltageV": voltage_v,
        "currentA": current_a,
        "temperatureC": round(temperature_c, 1),
        "errorCodes": error_codes or [],
    }
    if session_id is not None:
        doc["sessionId"] = session_id
    return doc


def _extract_max_kw(point_doc: dict[str, Any]) -> float:
    point_power = point_doc.get("power")
    if isinstance(point_power, dict):
        max_kw = point_power.get("maxKw")
        if isinstance(max_kw, (int, float)):
            return float(max_kw)

    connectors = point_doc.get("connectors")
    if isinstance(connectors, list):
        connector_powers = [
            float(connector.get("power"))
            for connector in connectors
            if isinstance(connector, dict)
            and isinstance(connector.get("power"), (int, float))
        ]
        if connector_powers:
            return max(connector_powers)

    return 22.0


def _normalize_datetime(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _stable_fraction(key: str) -> float:
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float(1 << 64)


class SimulationService:
    def __init__(self) -> None:
        self._running = False
        self._watch_task: asyncio.Task[None] | None = None
        self._reconcile_task: asyncio.Task[None] | None = None
        self._session_tasks: dict[str, asyncio.Task[None]] = {}

    @property
    def running(self) -> bool:
        return self._running

    async def start(self) -> bool:
        if self._running:
            logger.info("simulation service already running")
            return False

        self._running = True
        logger.info("starting simulation service")
        await self._run_reconciliation_pass()
        self._reconcile_task = asyncio.create_task(self._run_reconciliation_loop())
        self._watch_task = asyncio.create_task(self._watch_sessions())
        logger.info("simulation service started")
        return True

    async def stop(self) -> bool:
        if not self._running:
            logger.info("simulation service already stopped")
            return False

        self._running = False
        logger.info("stopping simulation service")

        if self._reconcile_task is not None:
            self._reconcile_task.cancel()
            try:
                await self._reconcile_task
            except asyncio.CancelledError:
                pass
            self._reconcile_task = None

        if self._watch_task is not None:
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass
            self._watch_task = None

        running_tasks = list(self._session_tasks.items())
        self._session_tasks.clear()
        for _, task in running_tasks:
            task.cancel()
        if running_tasks:
            await asyncio.gather(
                *(task for _, task in running_tasks), return_exceptions=True
            )

        logger.info("simulation service stopped")
        return True

    async def _run_reconciliation_loop(self) -> None:
        settings = get_settings()
        interval = max(settings.session_reconciliation_interval_seconds, 1.0)
        logger.info("reconciliation loop started")
        while self._running:
            try:
                await self._run_reconciliation_pass()
            except asyncio.CancelledError:
                logger.info("reconciliation loop cancelled")
                raise
            except Exception:
                logger.exception("reconciliation loop failed, retrying soon")
            await asyncio.sleep(interval)
        logger.info("reconciliation loop exiting")

    async def _run_reconciliation_pass(self) -> None:
        sessions = get_charging_sessions_collection()
        now = datetime.now(UTC)

        docs = await asyncio.to_thread(
            list,
            sessions.find(
                {"status": {"$in": ["ACTIVE", "BOOKED"]}},
                {
                    "_id": 1,
                    "status": 1,
                    "stationId": 1,
                    "chargingPointId": 1,
                    "booking": 1,
                    "cost": 1,
                    "charging.socStartPercent": 1,
                    "charging.socStopPercent": 1,
                    "charging.startedAt": 1,
                    "charging.meterStartKwh": 1,
                    "charging.meterStopKwh": 1,
                    "charging.energyDeliveredKwh": 1,
                    "pricingSnapshot.priceCentsPerKwh": 1,
                    "pricingSnapshot.idleFee": 1,
                    "updatedAt": 1,
                },
            ),
        )

        active_session_ids: set[str] = set()
        no_show_count = 0
        synced_booked = 0
        resumed_active = 0
        for doc in docs:
            status = doc.get("status")
            session_id = doc.get("_id")
            if not isinstance(session_id, ObjectId):
                continue

            if status == "BOOKED":
                if await self._reconcile_booked_session(doc, now):
                    if self._is_booking_expired(doc, now):
                        no_show_count += 1
                    else:
                        synced_booked += 1
                continue

            if status != "ACTIVE":
                continue

            active_session_ids.add(str(session_id))
            if str(session_id) not in self._session_tasks:
                resumed_active += 1
            await self.ensure_session_simulation_started(doc)

        running_tasks = list(self._session_tasks.keys())
        for session_key in running_tasks:
            if session_key in active_session_ids or not ObjectId.is_valid(session_key):
                continue
            await self.stop_session_simulation(ObjectId(session_key))

        logger.info(
            "reconciliation pass done: noShow=%s, booked=%s, resumedActive=%s, active=%s, scanned=%s",
            no_show_count,
            synced_booked,
            resumed_active,
            len(active_session_ids),
            len(docs),
        )

    def _is_booking_expired(
        self, session_doc: dict[str, Any], reference_time: datetime
    ) -> bool:
        booking = session_doc.get("booking")
        if not isinstance(booking, dict):
            return False

        expires_at = _normalize_datetime(
            booking.get("expiresAt") or booking.get("endAt")
        )
        return expires_at is not None and expires_at <= reference_time

    async def _mark_session_no_show(
        self, session_doc: dict[str, Any], timestamp: datetime
    ) -> bool:
        session_id = session_doc.get("_id")
        station_id = session_doc.get("stationId")
        charging_point_id = session_doc.get("chargingPointId")
        if not isinstance(session_id, ObjectId):
            return False

        sessions = get_charging_sessions_collection()
        final_timestamp = self._booking_reference_time(session_doc, timestamp)
        set_payload = self._build_booked_session_cost_update(
            session_doc, final_timestamp
        )
        set_payload.update(
            {
                "status": "NO_SHOW",
                "updatedAt": final_timestamp,
            }
        )
        result = await asyncio.to_thread(
            sessions.update_one,
            {
                "_id": session_id,
                "status": "BOOKED",
                "booking.canceledAt": None,
            },
            {"$set": set_payload},
        )
        if result.modified_count != 1:
            return False

        await asyncio.to_thread(
            self._release_charging_point,
            station_id,
            charging_point_id,
        )
        await self.stop_session_simulation(session_id)
        logger.info("session %s marked as NO_SHOW", session_id)
        return True

    def _booking_reference_time(
        self, session_doc: dict[str, Any], reference_time: datetime
    ) -> datetime:
        booking = session_doc.get("booking")
        if not isinstance(booking, dict):
            return reference_time

        expires_at = _normalize_datetime(booking.get("expiresAt") or booking.get("endAt"))
        if expires_at is None:
            return reference_time
        return min(reference_time, expires_at)

    def _calculate_booked_idle_cents(
        self, session_doc: dict[str, Any], reference_time: datetime | None
    ) -> int:
        booking = session_doc.get("booking")
        if not isinstance(booking, dict):
            return 0

        booked_at = _normalize_datetime(booking.get("bookedAt"))
        if booked_at is None:
            return 0

        expires_at = _normalize_datetime(booking.get("expiresAt") or booking.get("endAt"))
        return calculate_booked_idle_cents(
            booked_at=booked_at,
            reference_time=reference_time,
            idle_fee=resolve_idle_fee(session_doc.get("pricingSnapshot")),
            expires_at=expires_at,
        )

    def _build_booked_session_cost_update(
        self, session_doc: dict[str, Any], timestamp: datetime
    ) -> dict[str, Any]:
        idle_cents = self._calculate_booked_idle_cents(session_doc, timestamp)
        return {
            "cost.energyCents": 0,
            "cost.idleCents": idle_cents,
            "cost.totalCents": idle_cents,
        }

    def _needs_booked_session_cost_sync(
        self, session_doc: dict[str, Any], desired_idle_cents: int
    ) -> bool:
        cost = session_doc.get("cost")
        if not isinstance(cost, dict):
            return True

        current_energy = cost.get("energyCents")
        current_idle = cost.get("idleCents")
        current_total = cost.get("totalCents")
        return (
            current_energy != 0
            or current_idle != desired_idle_cents
            or current_total != desired_idle_cents
        )

    def _sync_booked_session_state(
        self,
        sessions_collection: Any,
        session_doc: dict[str, Any],
        timestamp: datetime,
    ) -> bool:
        session_id = session_doc.get("_id")
        if not isinstance(session_id, ObjectId):
            return False

        idle_cents = self._calculate_booked_idle_cents(session_doc, timestamp)
        if not self._needs_booked_session_cost_sync(session_doc, idle_cents):
            return True

        set_payload = self._build_booked_session_cost_update(session_doc, timestamp)
        set_payload["updatedAt"] = timestamp
        result = sessions_collection.update_one(
            {
                "_id": session_id,
                "status": "BOOKED",
                "booking.canceledAt": None,
            },
            {"$set": set_payload},
        )
        return result.matched_count == 1

    async def _reconcile_booked_session(
        self, session_doc: dict[str, Any], reference_time: datetime
    ) -> bool:
        if self._is_booking_expired(session_doc, reference_time):
            return await self._mark_session_no_show(session_doc, reference_time)

        sessions = get_charging_sessions_collection()
        return await asyncio.to_thread(
            self._sync_booked_session_state,
            sessions,
            session_doc,
            self._booking_reference_time(session_doc, reference_time),
        )

    def _is_battery_full(self, session_doc: dict[str, Any]) -> bool:
        charging = session_doc.get("charging")
        if not isinstance(charging, dict):
            return False

        soc_stop = charging.get("socStopPercent")
        if isinstance(soc_stop, (int, float)):
            return float(soc_stop) >= 100.0

        soc_start = charging.get("socStartPercent")
        if isinstance(soc_start, (int, float)):
            return float(soc_start) >= 100.0

        return False

    def _release_charging_point(
        self,
        station_id: ObjectId | Any,
        charging_point_id: ObjectId | Any,
    ) -> None:
        if not isinstance(station_id, ObjectId) or not isinstance(
            charging_point_id, ObjectId
        ):
            return

        stations = get_charging_stations_collection()
        stations.update_one(
            {
                "_id": station_id,
                "chargingPoints.chargingPointId": charging_point_id,
                "chargingPoints.availableNow": False,
            },
            {
                "$set": {"chargingPoints.$[point].availableNow": True},
                "$inc": {"availability.availableNowPoints": 1},
            },
            array_filters=[
                {
                    "point.chargingPointId": charging_point_id,
                    "point.availableNow": False,
                }
            ],
        )

    async def _watch_sessions(self) -> None:
        settings = get_settings()
        logger.info("watcher loop started")
        while self._running:
            try:
                await self._consume_changes()
            except asyncio.CancelledError:
                logger.info("watcher loop cancelled")
                raise
            except Exception:
                logger.exception("watcher loop failed, retrying soon")
                await asyncio.sleep(settings.change_stream_retry_seconds)

    async def _consume_changes(self) -> None:
        sessions = get_charging_sessions_collection()
        pipeline = [
            {
                "$match": {
                    "$or": [
                        {
                            "operationType": "insert",
                            "fullDocument.status": {"$in": ["ACTIVE", "BOOKED"]},
                        },
                        {
                            "operationType": "update",
                            "updateDescription.updatedFields.status": {"$exists": True},
                        },
                        {"operationType": "replace"},
                        {"operationType": "delete"},
                    ]
                }
            }
        ]

        with sessions.watch(
            pipeline=pipeline,
            full_document="updateLookup",
            max_await_time_ms=1000,
        ) as stream:
            logger.info("change stream opened on chargingSessions")
            while self._running:
                change = await asyncio.to_thread(stream.try_next)
                if change is None:
                    await asyncio.sleep(0.2)
                    continue
                await self._process_change(change)
            logger.info("change stream loop exiting")

    async def _process_change(self, change: dict[str, Any]) -> None:
        operation_type = change.get("operationType")
        document_key = change.get("documentKey", {})
        logger.info(
            "change detected operation=%s sessionId=%s",
            operation_type,
            document_key.get("_id"),
        )
        if operation_type == "delete":
            deleted_id = change.get("documentKey", {}).get("_id")
            if deleted_id is not None:
                await self.stop_session_simulation(deleted_id)
            return

        full_document = change.get("fullDocument")
        if not isinstance(full_document, dict):
            return

        status = full_document.get("status")
        session_id = full_document.get("_id")
        if session_id is None:
            return

        if status == "ACTIVE":
            await self.ensure_session_simulation_started(full_document)
            return

        if status == "BOOKED":
            await self.stop_session_simulation(session_id)
            await self._reconcile_booked_session(full_document, datetime.now(UTC))
            return

        logger.info(
            "session status is %s, stopping simulation for %s", status, session_id
        )
        await self.stop_session_simulation(session_id)

    async def ensure_session_simulation_started(
        self, session_doc: dict[str, Any]
    ) -> None:
        session_id = session_doc.get("_id")
        if session_id is None:
            logger.warning("cannot start simulation: missing session _id")
            return

        key = str(session_id)
        existing_task = self._session_tasks.get(key)
        if existing_task is not None and not existing_task.done():
            logger.info("session already being simulated: %s", key)
            return

        logger.info("starting simulation for session %s", key)
        task = asyncio.create_task(self._simulate_session(session_doc))
        self._session_tasks[key] = task
        task.add_done_callback(lambda _task, k=key: self._session_tasks.pop(k, None))

    async def stop_session_simulation(self, session_id: ObjectId) -> None:
        key = str(session_id)
        task = self._session_tasks.pop(key, None)
        if task is None:
            logger.info("stop requested for non-running session %s", key)
            return

        logger.info("stopping simulation for session %s", key)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        logger.info("simulation stopped for session %s", key)

    async def _build_session_context(
        self, session_doc: dict[str, Any]
    ) -> SessionTelemetryContext | None:
        station_id = session_doc.get("stationId")
        charging_point_id = session_doc.get("chargingPointId")
        if not isinstance(station_id, ObjectId) or not isinstance(
            charging_point_id, ObjectId
        ):
            logger.warning(
                "cannot build session context for %s: missing station/point ids",
                session_doc.get("_id"),
            )
            return None

        points = get_charging_points_collection()
        stations = get_charging_stations_collection()

        point_doc = await asyncio.to_thread(
            points.find_one,
            {"_id": charging_point_id},
            {
                "chargingPointCode": 1,
                "evseId": 1,
                "power.maxKw": 1,
                "connectors.power": 1,
            },
        )
        station_doc = await asyncio.to_thread(
            stations.find_one, {"_id": station_id}, {"stationCode": 1}
        )

        if not isinstance(point_doc, dict):
            logger.warning(
                "cannot build session context for %s: charging point not found %s",
                session_doc.get("_id"),
                charging_point_id,
            )
            return None

        charging_point_code = point_doc.get("chargingPointCode")
        evse_id = point_doc.get("evseId")
        station_code = (
            station_doc.get("stationCode")
            if isinstance(station_doc, dict)
            else "unknown"
        )

        return SessionTelemetryContext(
            station_id=station_id,
            charging_point_id=charging_point_id,
            station_code=station_code if isinstance(station_code, str) else "unknown",
            charging_point_code=(
                charging_point_code if isinstance(charging_point_code, str) else ""
            ),
            evse_id=evse_id if isinstance(evse_id, str) else "",
            max_kw=_extract_max_kw(point_doc),
        )

    async def _simulate_session(self, session_doc: dict[str, Any]) -> None:
        session_id = session_doc.get("_id")
        if not isinstance(session_id, ObjectId):
            logger.warning("cannot simulate session with invalid _id: %s", session_id)
            return

        context = await self._build_session_context(session_doc)
        if context is None:
            logger.warning("session %s skipped: context unavailable", session_id)
            return

        logger.info(
            "session %s simulation loop started station=%s point=%s",
            session_id,
            context.station_id,
            context.charging_point_id,
        )
        state = self._build_initial_session_state(session_doc)
        settings = get_settings()
        interval = max(settings.session_telemetry_interval_seconds, 0.5)
        telemetry = get_telemetry_collection()
        sessions = get_charging_sessions_collection()

        while self._running:
            try:
                previous_simulated_at = state.last_simulated_at
                advance = self._advance_session_state(
                    state=state,
                    context=context,
                    target_timestamp=datetime.now(UTC),
                    step_seconds=interval,
                )

                if advance.completed_at is not None or self._is_state_full(state):
                    completed_at = advance.completed_at or state.last_simulated_at
                    completed = await asyncio.to_thread(
                        self._complete_session_realtime,
                        sessions,
                        session_doc,
                        state,
                        completed_at,
                    )
                    if completed:
                        logger.info(
                            "session %s auto-completed at %s",
                            session_id,
                            completed_at.isoformat(),
                        )
                    return

                if advance.simulated_until > previous_simulated_at:
                    updated = await asyncio.to_thread(
                        self._sync_active_session_state,
                        sessions,
                        session_id,
                        state,
                        advance.simulated_until,
                    )
                    if not updated:
                        logger.info(
                            "session %s is no longer active, stopping simulation",
                            session_id,
                        )
                        return

                    voltage = 400 if context.max_kw <= 50 else 800
                    current_a = (
                        int(advance.power_kw * 1000 / voltage)
                        if voltage and advance.power_kw > 0
                        else 0
                    )
                    payload = _build_telemetry_doc(
                        timestamp=advance.simulated_until,
                        station_id=context.station_id,
                        charging_point_id=context.charging_point_id,
                        station_code=context.station_code,
                        charging_point_code=context.charging_point_code,
                        evse_id=context.evse_id,
                        message_type=MESSAGE_TYPE_SESSION_SAMPLE,
                        ok=True,
                        power_kw=advance.power_kw,
                        energy_kwh_delta=advance.energy_delta_kwh,
                        voltage_v=voltage,
                        current_a=current_a,
                        temperature_c=round(random.uniform(35, 42), 1),
                        error_codes=[],
                        session_id=session_id,
                    )
                    await asyncio.to_thread(telemetry.insert_one, payload)

                    if random.random() < FAULT_PROBABILITY:
                        fault_payload = _build_telemetry_doc(
                            timestamp=advance.simulated_until,
                            station_id=context.station_id,
                            charging_point_id=context.charging_point_id,
                            station_code=context.station_code,
                            charging_point_code=context.charging_point_code,
                            evse_id=context.evse_id,
                            message_type=MESSAGE_TYPE_FAULT,
                            ok=False,
                            power_kw=0.0,
                            energy_kwh_delta=0.0,
                            voltage_v=0,
                            current_a=0,
                            temperature_c=round(random.uniform(45, 55), 1),
                            error_codes=["E_OVERHEAT_WARN"],
                            session_id=session_id,
                        )
                        await asyncio.to_thread(telemetry.insert_one, fault_payload)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("session tick failed for session %s", session_id)
            await asyncio.sleep(self._seconds_until_next_tick(state, interval))

        logger.info("session %s simulation loop exiting", session_id)

    def _build_initial_session_state(
        self, session_doc: dict[str, Any]
    ) -> SessionSimulationState:
        charging = session_doc.get("charging")
        pricing_snapshot = session_doc.get("pricingSnapshot")
        session_key = str(session_doc.get("_id", "session"))

        started_at = datetime.now(UTC)
        last_simulated_at = started_at
        meter_start_kwh = round(
            8_000 + _stable_fraction(f"{session_key}:meter-start") * 52_000,
            3,
        )
        cumulative_energy_kwh = 0.0
        soc_start_percent = round(
            15 + _stable_fraction(f"{session_key}:soc-start") * 50,
            1,
        )
        soc_stop_percent = soc_start_percent
        price_cents_per_kwh = 55.0
        battery_capacity_kwh = 40 + _stable_fraction(
            f"{session_key}:battery-capacity"
        ) * 60
        booked_idle_cents = 0
        charging_started_at: datetime | None = None

        vehicle_profile = _stable_fraction(f"{session_key}:vehicle-profile")
        if vehicle_profile < 0.6:
            vehicle_max_power_kw = (
                50.0
                if _stable_fraction(f"{session_key}:vehicle-standard") < 0.5
                else 100.0
            )
        elif vehicle_profile < 0.9:
            vehicle_max_power_kw = 150.0
        else:
            vehicle_max_power_kw = 250.0

        if isinstance(charging, dict):
            meter_start = charging.get("meterStartKwh")
            meter_stop = charging.get("meterStopKwh")
            energy_delivered = charging.get("energyDeliveredKwh")
            soc_start = charging.get("socStartPercent")
            soc_stop = charging.get("socStopPercent")
            started_at_value = _normalize_datetime(charging.get("startedAt"))

            if started_at_value is not None:
                started_at = started_at_value
                charging_started_at = started_at_value

            if isinstance(meter_start, (int, float)):
                meter_start_kwh = float(meter_start)

            if isinstance(energy_delivered, (int, float)):
                cumulative_energy_kwh = max(float(energy_delivered), 0.0)
            elif isinstance(meter_stop, (int, float)) and isinstance(
                meter_start_kwh, float
            ):
                cumulative_energy_kwh = max(float(meter_stop) - meter_start_kwh, 0.0)

            if isinstance(soc_start, (int, float)):
                soc_start_percent = max(min(float(soc_start), 100.0), 0.0)
            if isinstance(soc_stop, (int, float)):
                soc_stop_percent = max(min(float(soc_stop), 100.0), soc_start_percent)

        updated_at = _normalize_datetime(session_doc.get("updatedAt"))
        if updated_at is not None:
            last_simulated_at = max(started_at, updated_at)
        else:
            last_simulated_at = started_at

        if meter_start_kwh <= 0:
            meter_start_kwh = round(
                8_000 + _stable_fraction(f"{session_key}:meter-start-fallback") * 52_000,
                3,
            )

        if isinstance(pricing_snapshot, dict):
            price = pricing_snapshot.get("priceCentsPerKwh")
            if isinstance(price, (int, float)) and price > 0:
                price_cents_per_kwh = float(price)

        cost = session_doc.get("cost")
        if isinstance(cost, dict) and isinstance(cost.get("idleCents"), (int, float)):
            booked_idle_cents = max(int(cost["idleCents"]), 0)
        if charging_started_at is not None:
            booked_idle_cents = max(
                booked_idle_cents,
                self._calculate_booked_idle_cents(session_doc, charging_started_at),
            )

        soc_delta_percent = max(soc_stop_percent - soc_start_percent, 0.0)
        if cumulative_energy_kwh > 0 and soc_delta_percent > 0:
            estimated_capacity_kwh = cumulative_energy_kwh / (soc_delta_percent / 100.0)
            if 30.0 <= estimated_capacity_kwh <= 110.0:
                battery_capacity_kwh = estimated_capacity_kwh

        return SessionSimulationState(
            started_at=started_at,
            last_simulated_at=last_simulated_at,
            meter_start_kwh=meter_start_kwh,
            cumulative_energy_kwh=cumulative_energy_kwh,
            soc_start_percent=soc_start_percent,
            soc_stop_percent=max(soc_stop_percent, soc_start_percent),
            price_cents_per_kwh=price_cents_per_kwh,
            battery_capacity_kwh=round(battery_capacity_kwh, 2),
            vehicle_max_power_kw=vehicle_max_power_kw,
            booked_idle_cents=booked_idle_cents,
        )

    def _is_state_full(self, state: SessionSimulationState) -> bool:
        return max(state.soc_stop_percent, state.soc_start_percent) >= 100.0

    def _seconds_until_next_tick(
        self, state: SessionSimulationState, interval_seconds: float
    ) -> float:
        elapsed = max(
            (datetime.now(UTC) - state.last_simulated_at).total_seconds(),
            0.0,
        )
        return max(min(interval_seconds - elapsed, interval_seconds), 0.5)

    def _calculate_power_kw(
        self,
        context: SessionTelemetryContext,
        state: SessionSimulationState,
        current_soc: float,
    ) -> float:
        if current_soc >= 100.0:
            return 0.0

        taper_factor = 1.0 if current_soc < 80.0 else max(
            0.0, (100.0 - current_soc) / 20.0
        )

        station_max = context.max_kw
        vehicle_limit = state.vehicle_max_power_kw
        if station_max < 40.0:
            vehicle_ac_limit = 22.0 if vehicle_limit >= 150.0 else 11.0
            effective_max_kw = min(station_max, vehicle_ac_limit)
        else:
            effective_max_kw = min(station_max, vehicle_limit)

        return round(max(effective_max_kw * 0.9 * taper_factor, 0.0), 2)

    def _advance_session_state(
        self,
        *,
        state: SessionSimulationState,
        context: SessionTelemetryContext,
        target_timestamp: datetime,
        step_seconds: float,
    ) -> SessionAdvanceResult:
        target = max(target_timestamp, state.last_simulated_at)
        total_energy_delta = 0.0
        power_kw = 0.0
        completed_at: datetime | None = None

        while state.last_simulated_at < target:
            current_soc = max(
                min(max(state.soc_stop_percent, state.soc_start_percent), 100.0),
                0.0,
            )
            if current_soc >= 100.0:
                state.soc_stop_percent = 100.0
                completed_at = state.last_simulated_at
                break

            chunk_end = min(
                state.last_simulated_at + timedelta(seconds=step_seconds),
                target,
            )
            elapsed_hours = max(
                (chunk_end - state.last_simulated_at).total_seconds() / 3600.0,
                0.0,
            )
            power_kw = self._calculate_power_kw(context, state, current_soc)
            max_energy_to_full = (
                max(100.0 - current_soc, 0.0) / 100.0
            ) * max(state.battery_capacity_kwh, 1.0)
            energy_delta = min(power_kw * elapsed_hours, max_energy_to_full)

            if energy_delta > 0:
                total_energy_delta += energy_delta
                state.cumulative_energy_kwh = max(
                    state.cumulative_energy_kwh + energy_delta,
                    0.0,
                )
                soc_gain = (energy_delta / max(state.battery_capacity_kwh, 1.0)) * 100.0
                state.soc_stop_percent = min(
                    100.0,
                    max(state.soc_stop_percent, state.soc_start_percent) + soc_gain,
                )

            state.last_simulated_at = chunk_end
            if max_energy_to_full <= energy_delta + 1e-9:
                state.soc_stop_percent = 100.0
                completed_at = chunk_end
                break

        return SessionAdvanceResult(
            energy_delta_kwh=round(total_energy_delta, 4),
            power_kw=0.0 if completed_at is not None else power_kw,
            simulated_until=state.last_simulated_at,
            completed_at=completed_at,
        )

    def _build_session_state_update(
        self,
        state: SessionSimulationState,
        timestamp: datetime,
    ) -> dict[str, Any]:
        meter_stop_kwh = round(state.meter_start_kwh + state.cumulative_energy_kwh, 3)
        energy_cents = int(round(state.cumulative_energy_kwh * state.price_cents_per_kwh))
        total_cents = energy_cents + state.booked_idle_cents
        return {
            "charging.startedAt": state.started_at,
            "charging.meterStartKwh": state.meter_start_kwh,
            "charging.meterStopKwh": meter_stop_kwh,
            "charging.energyDeliveredKwh": round(state.cumulative_energy_kwh, 3),
            "charging.socStartPercent": round(state.soc_start_percent, 1),
            "charging.socStopPercent": round(state.soc_stop_percent, 1),
            "cost.energyCents": energy_cents,
            "cost.idleCents": state.booked_idle_cents,
            "cost.totalCents": total_cents,
            "updatedAt": timestamp,
        }

    def _sync_active_session_state(
        self,
        sessions_collection: Any,
        session_id: ObjectId,
        state: SessionSimulationState,
        timestamp: datetime,
    ) -> bool:
        result = sessions_collection.update_one(
            {"_id": session_id, "status": "ACTIVE"},
            {
                "$set": self._build_session_state_update(state, timestamp)
            },
        )
        return result.modified_count == 1

    def _complete_session_realtime(
        self,
        sessions_collection: Any,
        session_doc: dict[str, Any],
        state: SessionSimulationState,
        completed_at: datetime,
    ) -> bool:
        session_id = session_doc.get("_id")
        if not isinstance(session_id, ObjectId):
            return False

        set_payload = self._build_session_state_update(state, completed_at)
        set_payload.update(
            {
                "status": "COMPLETED",
                "charging.endedAt": completed_at,
            }
        )
        result = sessions_collection.update_one(
            {"_id": session_id, "status": "ACTIVE"},
            {"$set": set_payload},
        )
        if result.modified_count != 1:
            return False

        self._release_charging_point(
            session_doc.get("stationId"),
            session_doc.get("chargingPointId"),
        )
        return True
