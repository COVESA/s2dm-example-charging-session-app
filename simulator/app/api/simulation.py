from fastapi import APIRouter

from app.models.simulation import SimulationActionResponse, SimulationStatusResponse
from app.services.simulation_service import SimulationService

router = APIRouter(tags=["simulation"])
service = SimulationService()


@router.get("/status", response_model=SimulationStatusResponse)
async def status() -> SimulationStatusResponse:
    return SimulationStatusResponse(running=service.running)


@router.post("/start", response_model=SimulationActionResponse)
async def start() -> SimulationActionResponse:
    started = await service.start()
    return SimulationActionResponse(
        running=service.running,
        message="Simulation started" if started else "Simulation is already running",
    )


@router.post("/stop", response_model=SimulationActionResponse)
async def stop() -> SimulationActionResponse:
    stopped = await service.stop()
    return SimulationActionResponse(
        running=service.running,
        message="Simulation stopped" if stopped else "Simulation is already stopped",
    )
