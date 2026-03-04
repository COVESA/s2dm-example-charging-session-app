import os
from dataclasses import dataclass
from urllib.parse import urlparse

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str
    mongodb_database: str
    simulator_url: str
    bind_port: int
    session_telemetry_interval_seconds: float
    change_stream_retry_seconds: float


def _port_from_url(url: str, default: int = 8000) -> int:
    try:
        parsed = urlparse(url)
        return int(parsed.port) if parsed.port else default
    except (ValueError, TypeError):
        return default


def get_settings() -> Settings:
    simulator_url = os.getenv("SIMULATOR_URL", "http://localhost:8000")
    return Settings(
        mongodb_uri=os.getenv("MONGODB_URI", "mongodb://localhost:27017/charging_demo"),
        mongodb_database=os.getenv("MONGODB_DATABASE", "charging_demo"),
        simulator_url=simulator_url,
        bind_port=_port_from_url(simulator_url),
        session_telemetry_interval_seconds=float(
            os.getenv(
                "SESSION_TELEMETRY_INTERVAL_SECONDS",
                os.getenv("SIMULATION_INTERVAL_SECONDS", "2"),
            )
        ),
        change_stream_retry_seconds=float(os.getenv("CHANGE_STREAM_RETRY_SECONDS", "2")),
    )
