import asyncio
import random
import time
from datetime import UTC, datetime
from typing import Any

from bson.objectid import ObjectId

from app.config import get_settings
from app.db.mongo import (
    get_charging_points_collection,
    get_charging_stations_collection,
    get_telemetry_collection,
)


# Message types per schema design (section 4.7)
MESSAGE_TYPE_HEARTBEAT = "HEARTBEAT"
MESSAGE_TYPE_SESSION_SAMPLE = "SESSION_SAMPLE"
MESSAGE_TYPE_FAULT = "FAULT"

# Fault probability per tick (low rate for demo)
FAULT_PROBABILITY = 0.02


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
    """Build a telemetry document matching the schema design (section 4.7)."""
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


class SimulationService:
    def __init__(self) -> None:
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._points_cache: list[dict[str, Any]] = []
        self._station_code_map: dict[str, str] = {}
        self._last_refresh: float = 0
        self._refresh_interval_seconds = 30

    @property
    def running(self) -> bool:
        return self._running

    def _refresh_points(self) -> None:
        """Load charging points and station codes from DB."""
        points_coll = get_charging_points_collection()
        stations_coll = get_charging_stations_collection()

        stations = list(stations_coll.find({}, {"_id": 1, "stationCode": 1}))
        station_code_map = {str(s["_id"]): s["stationCode"] for s in stations}

        points = list(
            points_coll.find(
                {},
                {
                    "_id": 1,
                    "stationId": 1,
                    "chargingPointCode": 1,
                    "evseId": 1,
                    "power.maxKw": 1,
                    "currentSessionId": 1,
                },
            )
        )

        self._points_cache = points
        self._station_code_map = station_code_map
        self._last_refresh = time.monotonic()

    async def start(self) -> bool:
        if self._running:
            return False

        self._running = True
        self._task = asyncio.create_task(self._emit_loop())
        return True

    async def stop(self) -> bool:
        if not self._running:
            return False

        self._running = False

        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        return True

    async def _emit_loop(self) -> None:
        settings = get_settings()
        telemetry_collection = get_telemetry_collection()
        interval = max(settings.simulation_interval_seconds, 0.5)

        # Initial load of charging points
        try:
            self._refresh_points()
        except Exception:
            pass

        while self._running:
            now = datetime.now(UTC)
            loop_time = time.monotonic()

            # Refresh points cache periodically
            if loop_time - self._last_refresh > self._refresh_interval_seconds:
                try:
                    self._refresh_points()
                except Exception:
                    pass  # Keep using cached data

            if not self._points_cache:
                try:
                    self._refresh_points()
                except Exception:
                    pass

            for point in self._points_cache:
                try:
                    doc = self._build_telemetry_for_point(point, now)
                    if doc:
                        telemetry_collection.insert_one(doc)
                except Exception:
                    pass  # Skip failed points, continue simulation

            await asyncio.sleep(interval)

    def _build_telemetry_for_point(
        self, point: dict[str, Any], timestamp: datetime
    ) -> dict[str, Any] | None:
        """Build one telemetry document for a charging point per schema design."""
        station_id = point.get("stationId")
        charging_point_id = point.get("_id")
        charging_point_code = point.get("chargingPointCode", "")
        evse_id = point.get("evseId", "")
        max_kw = point.get("power", {}).get("maxKw", 22)
        current_session_id = point.get("currentSessionId")

        if not station_id or not charging_point_id:
            return None

        station_code = self._station_code_map.get(str(station_id), "unknown")

        # Occasional fault (schema: FAULT with ok=false, errorCodes)
        if random.random() < FAULT_PROBABILITY:
            return _build_telemetry_doc(
                timestamp=timestamp,
                station_id=station_id,
                charging_point_id=charging_point_id,
                station_code=station_code,
                charging_point_code=charging_point_code,
                evse_id=evse_id,
                message_type=MESSAGE_TYPE_FAULT,
                ok=False,
                power_kw=0.0,
                energy_kwh_delta=0.0,
                voltage_v=0,
                current_a=0,
                temperature_c=round(random.uniform(45, 55), 1),
                error_codes=["E_OVERHEAT_WARN"],
            )

        # Active charging → SESSION_SAMPLE (higher-frequency diagnostics)
        if current_session_id:
            power_kw = round(random.uniform(max_kw * 0.6, max_kw * 0.95), 2)
            voltage = 400 if max_kw <= 50 else 800
            current_a = int(power_kw * 1000 / voltage) if voltage else 0
            return _build_telemetry_doc(
                timestamp=timestamp,
                station_id=station_id,
                charging_point_id=charging_point_id,
                station_code=station_code,
                charging_point_code=charging_point_code,
                evse_id=evse_id,
                message_type=MESSAGE_TYPE_SESSION_SAMPLE,
                ok=True,
                power_kw=power_kw,
                energy_kwh_delta=round(random.uniform(0.1, 0.3), 3),
                voltage_v=voltage,
                current_a=current_a,
                temperature_c=round(random.uniform(35, 42), 1),
                error_codes=[],
                session_id=current_session_id,
            )

        # Idle → HEARTBEAT (schema: each point emits heartbeats when idle)
        return _build_telemetry_doc(
            timestamp=timestamp,
            station_id=station_id,
            charging_point_id=charging_point_id,
            station_code=station_code,
            charging_point_code=charging_point_code,
            evse_id=evse_id,
            message_type=MESSAGE_TYPE_HEARTBEAT,
            ok=True,
            power_kw=0.0,
            energy_kwh_delta=0.0,
            voltage_v=400 if max_kw <= 50 else 800,
            current_a=0,
            temperature_c=round(random.uniform(28, 35), 1),
            error_codes=[],
        )
