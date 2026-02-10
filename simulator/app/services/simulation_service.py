import asyncio
import random
from datetime import UTC, datetime

from app.config import get_settings
from app.db.mongo import get_telemetry_collection


class SimulationService:
    def __init__(self) -> None:
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._station_ids = ["station-001", "station-002", "station-003"]

    @property
    def running(self) -> bool:
        return self._running

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

        while self._running:
            payload = {
                "stationId": random.choice(self._station_ids),
                "powerKw": round(random.uniform(6.2, 22.0), 2),
                "energyKwh": round(random.uniform(0.1, 1.2), 3),
                "timestamp": datetime.now(UTC).isoformat(),
            }
            telemetry_collection.insert_one(payload)
            await asyncio.sleep(interval)
