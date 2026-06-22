from pydantic import BaseModel, Field


class ShareCreate(BaseModel):
    label: str | None = None
    # Default 2h; hard-capped at 24h server-side (a shareable URL with no
    # ceiling is a slow leak). Pydantic rejects out-of-range with 422.
    ttl_hours: int = Field(default=2, ge=1, le=24)
