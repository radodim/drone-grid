import uuid
from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.utils import get_utcnow


class Drone(SQLModel, table=True):
    # TODO: set a MetaData naming_convention so constraint/index names are
    # deterministic — simplifies Alembic migrations (this one is DB-auto-named).
    __table_args__ = (UniqueConstraint("name", "creation_user_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    secret_hash: str
    creation_user_id: uuid.UUID = Field(
        foreign_key="user.id", index=True, ondelete="CASCADE"
    )
    creation_timestamp: datetime = Field(default_factory=get_utcnow)
    update_timestamp: datetime = Field(default_factory=get_utcnow)
