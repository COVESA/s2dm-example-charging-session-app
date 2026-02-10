from pydantic import BaseModel


class SimulationStatusResponse(BaseModel):
    running: bool


class SimulationActionResponse(BaseModel):
    running: bool
    message: str
