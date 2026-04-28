from pydantic import BaseModel

# This schema is duplicated at services/companion/app/models.py.
# If you change it here, change it there.


class Position(BaseModel):
    lat: float
    lon: float
    alt: float


class Telemetry(BaseModel):
    armed: bool
    mode: str
    battery: float | None
    position: Position
