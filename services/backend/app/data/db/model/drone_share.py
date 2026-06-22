import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel

from app.utils import get_utcnow


class DroneShare(SQLModel, table=True):
    __tablename__ = "drone_share"  # type: ignore[assignment]

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    drone_id: uuid.UUID = Field(foreign_key="drone.id", index=True, ondelete="CASCADE")
    creation_user_id: uuid.UUID | None = Field(
        default=None, foreign_key="user.id", ondelete="SET NULL"
    )
    token_hash: str = Field(index=True, unique=True)
    label: str | None = None
    creation_timestamp: datetime = Field(default_factory=get_utcnow)
    expiration_timestamp: datetime
    revocation_timestamp: datetime | None = None
