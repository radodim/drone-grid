from pydantic import BaseModel, Field


class ShareCreate(BaseModel):
    label: str | None = None
    ttl_hours: int = Field(default=2, ge=1, le=24)
