from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ── Video sources ─────────────────────────────────────────────


class RpicamVideoSourceConfig(BaseModel):
    type: Literal["rpicam"] = "rpicam"
    width: int = 960
    height: int = 720
    fps: int = 30
    bitrate: str = "2000k"


class GazeboVideoSourceConfig(BaseModel):
    type: Literal["gazebo"] = "gazebo"
    port: int = 5600


VideoSourceConfig = Annotated[
    RpicamVideoSourceConfig | GazeboVideoSourceConfig,
    Field(discriminator="type"),
]


# ── Video publishers ──────────────────────────────────────────


class RtspVideoPublisherConfig(BaseModel):
    type: Literal["rtsp"] = "rtsp"
    secure: bool = False


class WhipVideoPublisherConfig(BaseModel):
    type: Literal["whip"] = "whip"
    secure: bool = False


VideoPublisherConfig = Annotated[
    RtspVideoPublisherConfig | WhipVideoPublisherConfig,
    Field(discriminator="type"),
]


# ── Video pipeline (source + publisher together) ──────────────


class VideoPipelineConfig(BaseModel):
    source: VideoSourceConfig
    publisher: VideoPublisherConfig = RtspVideoPublisherConfig()
    media_server_url: str


# ── Control ───────────────────────────────────────────────────


class MavsdkControlConfig(BaseModel):
    connection_url: str
    messaging_url: str


# ── Top-level settings ────────────────────────────────────────


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_ignore_empty=True,
        env_nested_delimiter="__",
        extra="ignore",
        # CLI args layer on top of env; precedence is CLI > env > defaults.
        cli_parse_args=True,
        cli_kebab_case=True,
        cli_avoid_json=True,
        cli_implicit_flags=True,
    )

    drone_id: str
    drone_secret: str

    video: VideoPipelineConfig | None = None
    control: MavsdkControlConfig | None = None

    @model_validator(mode="after")
    def _require_at_least_one_subsystem(self) -> "Settings":
        if self.video is None and self.control is None:
            raise ValueError(
                "At least one of `video` or `control` must be configured. "
                "Set VIDEO__SOURCE__TYPE or CONTROL__CONNECTION_URL."
            )
        return self


GLOBAL_APP_SETTINGS = Settings()  # type: ignore[call-arg]
