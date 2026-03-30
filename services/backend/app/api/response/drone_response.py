import uuid
from datetime import datetime

from pydantic import BaseModel

from app.data.db.model.drone import Drone


class DroneResponse(BaseModel):
    id: uuid.UUID
    name: str
    secret_key: str
    owner_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    stream_url: str | None = None

    @classmethod
    def from_drone(cls, drone: Drone, stream_url: str | None = None) -> "DroneResponse":
        return cls(**drone.model_dump(), stream_url=stream_url)
