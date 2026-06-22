import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel

from app.data.db.model.utils import get_utcnow


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sub: str = Field(index=True, unique=True)
    issuer: str
    email: str
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_admin: bool = Field(default=False)
    creation_timestamp: datetime = Field(default_factory=get_utcnow)
    update_timestamp: datetime = Field(default_factory=get_utcnow)
