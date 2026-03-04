import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.simulation_service import SimulationService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

app = FastAPI(title="EV Charging Simulator")
service = SimulationService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def start_simulation_service() -> None:
    await service.start()


@app.on_event("shutdown")
async def stop_simulation_service() -> None:
    await service.stop()


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
