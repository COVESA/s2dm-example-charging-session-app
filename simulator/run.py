"""Run the simulator with port derived from SIMULATOR_URL."""
import uvicorn

from app.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.bind_port,
        reload=False,
    )
