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
        # Map the renamed model columns to the (currently unchanged) API names.
        # A global API-vs-DB naming pass is the separate DTO-unification step.
        return cls(
            id=drone.id,
            name=drone.name,
            secret_key=drone.secret_key,
            owner_id=drone.creation_user_id,
            created_at=drone.creation_timestamp,
            updated_at=drone.update_timestamp,
            stream_url=stream_url,
        )
