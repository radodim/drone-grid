import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sub: str = Field(index=True, unique=True)
    issuer: str
    email: str
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_admin: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))  # type: ignore[call-overload]
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))  # type: ignore[call-overload]
