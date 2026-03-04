import asyncio
import logging
import random
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from bson.objectid import ObjectId

from app.config import get_settings
from app.db.mongo import (
    get_charging_points_collection,
    get_charging_sessions_collection,
    get_charging_stations_collection,
    get_telemetry_collection,
)

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
    meter_start_kwh: float
    cumulative_energy_kwh: float
    soc_start_percent: float
    soc_stop_percent: float
    price_cents_per_kwh: float
    battery_capacity_kwh: float
    vehicle_max_power_kw: float


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


class SimulationService:
    def __init__(self) -> None:
        self._running = False
        self._watch_task: asyncio.Task[None] | None = None
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
        await self._run_startup_sanity_check()
        self._watch_task = asyncio.create_task(self._watch_sessions())
        logger.info("simulation service started")
        return True

    async def stop(self) -> bool:
        if not self._running:
            logger.info("simulation service already stopped")
            return False

        self._running = False
        logger.info("stopping simulation service")

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

    async def _run_startup_sanity_check(self) -> None:
        sessions = get_charging_sessions_collection()
        now = datetime.now(UTC)

        no_show_result = await asyncio.to_thread(
            sessions.update_many,
            {
                "status": "BOOKED",
                "$or": [
                    {"booking.expiresAt": {"$lte": now}},
                    {"booking.endAt": {"$lte": now}},
                ],
            },
            {"$set": {"status": "NO_SHOW", "updatedAt": now}},
        )

        docs = await asyncio.to_thread(
            list,
            sessions.find(
                {"status": {"$in": ["CANCELED", "ACTIVE", "BOOKED"]}},
                {
                    "_id": 1,
                    "status": 1,
                    "stationId": 1,
                    "chargingPointId": 1,
                    "charging.socStartPercent": 1,
                    "charging.socStopPercent": 1,
                },
            ),
        )

        resumed_active = 0
        for doc in docs:
            status = doc.get("status")
            session_id = doc.get("_id")
            if not isinstance(session_id, ObjectId):
                continue

            if status == "CANCELED":
                await self.stop_session_simulation(session_id)
                continue

            if status == "ACTIVE" and not self._is_battery_full(doc):
                if str(session_id) not in self._session_tasks:
                    resumed_active += 1
                await self.ensure_session_simulation_started(doc)

        logger.info(
            "startup sanity check done: noShow=%s, resumedActive=%s, scanned=%s",
            no_show_result.modified_count,
            resumed_active,
            len(docs),
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
                            "fullDocument.status": "ACTIVE",
                        },
                        {
                            "operationType": "update",
                            "updateDescription.updatedFields.status": {"$exists": True},
                        },
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
                timestamp = datetime.now(UTC)
                energy_delta = 0.0
                if random.random() < FAULT_PROBABILITY:
                    payload = _build_telemetry_doc(
                        timestamp=timestamp,
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
                else:
                    interval_hours = interval / 3600.0
                    current_soc = max(
                        min(
                            max(state.soc_stop_percent, state.soc_start_percent),
                            100.0,
                        ),
                        0.0,
                    )

                    if current_soc >= 100.0:
                        power_kw = 0.0
                        energy_delta = 0.0
                    else:
                        # Charge taper: near-full batteries draw less power.
                        if current_soc < 80.0:
                            taper_factor = 1.0
                        else:
                            taper_factor = max(0.0, (100.0 - current_soc) / 20.0)

                        # Determine session limits
                        # If station max < 40kW, assume AC charging (vehicle likely limited to 11/22kW)
                        # If station max >= 40kW, assume DC charging (vehicle limited by its DC max)
                        
                        station_max = context.max_kw
                        vehicle_limit = state.vehicle_max_power_kw

                        if station_max < 40.0:
                             # AC charging: most cars take 11kW, some 22kW.
                             # If vehicle_limit is high (DC value), cap it to 11kW or 22kW for AC.
                             # Let's assume the vehicle AC charger is 11kW unless it's a "fast" car.
                             vehicle_ac_limit = 22.0 if vehicle_limit >= 150.0 else 11.0
                             effective_max_kw = min(station_max, vehicle_ac_limit)
                        else:
                             # DC charging
                             effective_max_kw = min(station_max, vehicle_limit)

                        base_power_kw = random.uniform(
                            effective_max_kw * 0.8, effective_max_kw * 0.98
                        )
                        raw_power_kw = max(base_power_kw * taper_factor, 0.0)
                        raw_energy_delta = raw_power_kw * interval_hours
                        max_energy_to_full = (
                            max(100.0 - current_soc, 0.0) / 100.0
                        ) * max(state.battery_capacity_kwh, 1.0)
                        energy_delta = round(
                            min(raw_energy_delta, max_energy_to_full),
                            4,
                        )
                        power_kw = (
                            round(energy_delta / interval_hours, 2)
                            if interval_hours > 0 and energy_delta > 0
                            else 0.0
                        )

                    voltage = 400 if context.max_kw <= 50 else 800
                    current_a = int(power_kw * 1000 / voltage) if voltage else 0
                    payload = _build_telemetry_doc(
                        timestamp=timestamp,
                        station_id=context.station_id,
                        charging_point_id=context.charging_point_id,
                        station_code=context.station_code,
                        charging_point_code=context.charging_point_code,
                        evse_id=context.evse_id,
                        message_type=MESSAGE_TYPE_SESSION_SAMPLE,
                        ok=True,
                        power_kw=power_kw,
                        energy_kwh_delta=energy_delta,
                        voltage_v=voltage,
                        current_a=current_a,
                        temperature_c=round(random.uniform(35, 42), 1),
                        error_codes=[],
                        session_id=session_id,
                    )

                await asyncio.to_thread(telemetry.insert_one, payload)
                await asyncio.to_thread(
                    self._update_session_realtime,
                    sessions,
                    session_id,
                    state,
                    energy_delta,
                    timestamp,
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("session tick failed for session %s", session_id)
            await asyncio.sleep(interval)

        logger.info("session %s simulation loop exiting", session_id)

    def _build_initial_session_state(
        self, session_doc: dict[str, Any]
    ) -> SessionSimulationState:
        charging = session_doc.get("charging")
        pricing_snapshot = session_doc.get("pricingSnapshot")

        started_at = datetime.now(UTC)
        meter_start_kwh = 0.0
        cumulative_energy_kwh = 0.0
        soc_start_percent = float(random.randint(15, 65))
        soc_stop_percent = soc_start_percent
        price_cents_per_kwh = 55.0
        battery_capacity_kwh = random.uniform(40.0, 100.0)
        
        # Vehicle capability distribution
        # 60% standard AC/DC (11kW AC / 50-100kW DC)
        # 30% mid-range (22kW AC / 150kW DC)
        # 10% high-end (22kW AC / 250kW DC)
        rand_veh = random.random()
        if rand_veh < 0.6:
             vehicle_max_power_kw = random.choice([50.0, 100.0]) if random.random() > 0.5 else 11.0
        elif rand_veh < 0.9:
             vehicle_max_power_kw = 150.0
        else:
             vehicle_max_power_kw = 250.0

        if isinstance(charging, dict):
            meter_start = charging.get("meterStartKwh")
            meter_stop = charging.get("meterStopKwh")
            energy_delivered = charging.get("energyDeliveredKwh")
            soc_start = charging.get("socStartPercent")
            soc_stop = charging.get("socStopPercent")
            started_at_value = charging.get("startedAt")

            if isinstance(started_at_value, datetime):
                started_at = started_at_value

            if isinstance(meter_start, (int, float)):
                meter_start_kwh = float(meter_start)
            else:
                meter_start_kwh = round(random.uniform(8_000, 60_000), 3)

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

        if meter_start_kwh <= 0:
            meter_start_kwh = round(random.uniform(8_000, 60_000), 3)

        if isinstance(pricing_snapshot, dict):
            price = pricing_snapshot.get("priceCentsPerKwh")
            if isinstance(price, (int, float)) and price > 0:
                price_cents_per_kwh = float(price)

        soc_delta_percent = max(soc_stop_percent - soc_start_percent, 0.0)
        if cumulative_energy_kwh > 0 and soc_delta_percent > 0:
            estimated_capacity_kwh = cumulative_energy_kwh / (soc_delta_percent / 100.0)
            if 30.0 <= estimated_capacity_kwh <= 110.0:
                battery_capacity_kwh = estimated_capacity_kwh

        return SessionSimulationState(
            started_at=started_at,
            meter_start_kwh=meter_start_kwh,
            cumulative_energy_kwh=cumulative_energy_kwh,
            soc_start_percent=soc_start_percent,
            soc_stop_percent=max(soc_stop_percent, soc_start_percent),
            price_cents_per_kwh=price_cents_per_kwh,
            battery_capacity_kwh=round(battery_capacity_kwh, 2),
            vehicle_max_power_kw=vehicle_max_power_kw,
        )

    def _update_session_realtime(
        self,
        sessions_collection: Any,
        session_id: ObjectId,
        state: SessionSimulationState,
        energy_delta: float,
        timestamp: datetime,
    ) -> None:
        # Keep updates bounded to ACTIVE sessions only, avoiding stale writes after completion.
        if energy_delta > 0:
            state.cumulative_energy_kwh = round(
                state.cumulative_energy_kwh + energy_delta, 3
            )
            soc_gain = (energy_delta / max(state.battery_capacity_kwh, 1.0)) * 100.0
            state.soc_stop_percent = min(
                100.0,
                max(state.soc_stop_percent, state.soc_start_percent) + soc_gain,
            )

        meter_stop_kwh = round(state.meter_start_kwh + state.cumulative_energy_kwh, 3)
        energy_cents = int(
            round(state.cumulative_energy_kwh * state.price_cents_per_kwh)
        )

        sessions_collection.update_one(
            {"_id": session_id, "status": "ACTIVE"},
            {
                "$set": {
                    "charging.startedAt": state.started_at,
                    "charging.meterStartKwh": state.meter_start_kwh,
                    "charging.meterStopKwh": meter_stop_kwh,
                    "charging.energyDeliveredKwh": state.cumulative_energy_kwh,
                    "charging.socStartPercent": round(state.soc_start_percent, 1),
                    "charging.socStopPercent": round(state.soc_stop_percent, 1),
                    "cost.energyCents": energy_cents,
                    "cost.idleCents": 0,
                    "cost.totalCents": energy_cents,
                    "updatedAt": timestamp,
                }
            },
        )
