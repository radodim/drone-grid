import uuid
from datetime import datetime

from pydantic import BaseModel

from app.data.db.model.drone import Drone


class DroneResponse(BaseModel):
    id: uuid.UUID
    name: str
    creation_user_id: uuid.UUID
    creation_timestamp: datetime
    update_timestamp: datetime
    stream_url: str | None = None

    @classmethod
    def from_drone(cls, drone: Drone, stream_url: str | None = None) -> "DroneResponse":
        return cls(
            id=drone.id,
            name=drone.name,
            creation_user_id=drone.creation_user_id,
            creation_timestamp=drone.creation_timestamp,
            update_timestamp=drone.update_timestamp,
            stream_url=stream_url,
        )


class DroneSecretResponse(DroneResponse):
    secret: str

    @classmethod
    def from_drone_with_secret(cls, drone: Drone, secret: str) -> "DroneSecretResponse":
        return cls(**DroneResponse.from_drone(drone).model_dump(), secret=secret)
