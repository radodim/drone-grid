import uuid
from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.data.db.model.utils import get_utcnow


class Drone(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("name", "creation_user_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    secret_key: str = Field(default_factory=lambda: uuid.uuid4().hex)
    creation_user_id: uuid.UUID = Field(
        foreign_key="user.id", index=True, ondelete="CASCADE"
    )
    creation_timestamp: datetime = Field(default_factory=get_utcnow)
    update_timestamp: datetime = Field(default_factory=get_utcnow)
