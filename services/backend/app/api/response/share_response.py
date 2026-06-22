import uuid
from datetime import datetime

from pydantic import BaseModel

from app.data.db.model.drone_share import DroneShare


class ShareCreated(BaseModel):
    """Returned once at creation — the only time the plaintext token is exposed."""

    id: uuid.UUID
    token: str
    expires_at: datetime


class ShareSummary(BaseModel):
    """Metadata for an active share (no token — only its hash is stored)."""

    id: uuid.UUID
    label: str | None
    created_at: datetime
    expires_at: datetime

    @classmethod
    def from_share(cls, share: DroneShare) -> "ShareSummary":
        return cls(
            id=share.id,
            label=share.label,
            created_at=share.creation_timestamp,
            expires_at=share.expiration_timestamp,
        )


class ShareResolved(BaseModel):
    """Public resolve result — what a viewer needs to open the streams."""

    drone_id: uuid.UUID
    drone_name: str
