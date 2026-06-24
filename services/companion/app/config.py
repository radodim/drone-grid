from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RpicamVideo(BaseModel):
    type: Literal["rpicam"]
    width: int = 1280
    height: int = 720
    fps: int = 30
    bitrate: str = "3m"
    vflip: bool = True
    hflip: bool = True


class GazeboVideo(BaseModel):
    type: Literal["gazebo"]
    port: int = 5600


VideoSourceConfig = Annotated[
    RpicamVideo | GazeboVideo,
    Field(discriminator="type"),
]


class VideoConfig(BaseModel):
    source: VideoSourceConfig
    media_server_url: str
    secure: bool = False
    restart_delay_s: float = 5.0


class ControlConfig(BaseModel):
    connection_url: str
    messaging_url: str
    restart_delay_s: float = 5.0
    heartbeat_s: float = 15.0
    telemetry_period_s: float = 0.5


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_ignore_empty=True,
        env_nested_delimiter="__",
        extra="ignore",
        # precedence is CLI > env > defaults.
        cli_parse_args=True,
        cli_kebab_case=True,
        cli_avoid_json=True,
        cli_implicit_flags=True,
    )

    drone_id: str
    drone_secret: str

    control: ControlConfig | None = None
    video: VideoConfig | None = None

    @model_validator(mode="after")
    def _require_a_subsystem(self) -> "Settings":
        if self.control is None and self.video is None:
            raise ValueError(
                "Configure at least one subsystem: control "
                "(CONTROL__CONNECTION_URL + CONTROL__MESSAGING_URL) or video "
                "(VIDEO__SOURCE__TYPE + VIDEO__MEDIA_SERVER_URL)."
            )
        return self


GLOBAL_APP_SETTINGS = Settings()  # type: ignore[call-arg]
