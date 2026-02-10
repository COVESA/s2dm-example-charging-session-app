import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str
    mongodb_database: str
    simulator_port: int
    simulation_interval_seconds: float


def get_settings() -> Settings:
    return Settings(
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017/charging_demo"),
        mongodb_database=os.getenv("MONGODB_DATABASE", "charging_demo"),
        simulator_port=int(os.getenv("SIMULATOR_PORT", "8000")),
        simulation_interval_seconds=float(os.getenv("SIMULATION_INTERVAL_SECONDS", "2")),
    )
