import uuid
from datetime import datetime

from pydantic import BaseModel

from app.data.db.model.drone_share import DroneShare


class ShareCreatedResponse(BaseModel):
    id: uuid.UUID
    token: str
    expiration_timestamp: datetime


class ShareResponse(BaseModel):
    id: uuid.UUID
    label: str | None
    creation_timestamp: datetime
    expiration_timestamp: datetime

    @classmethod
    def from_share(cls, share: DroneShare) -> "ShareResponse":
        return cls(
            id=share.id,
            label=share.label,
            creation_timestamp=share.creation_timestamp,
            expiration_timestamp=share.expiration_timestamp,
        )


class ShareResolvedResponse(BaseModel):
    drone_id: uuid.UUID
