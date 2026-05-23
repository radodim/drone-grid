from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RpicamVideo(BaseModel):
    type: Literal["rpicam"]
    width: int = 960
    height: int = 720
    fps: int = 30
    bitrate: str = "2000k"


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


class ControlConfig(BaseModel):
    connection_url: str
    messaging_url: str


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

    # Shared identity — used for both messaging auth (control) and media auth
    # (video), so required regardless of which subsystems are enabled.
    drone_id: str
    drone_secret: str

    # Each subsystem is all-or-nothing: present (fully configured) or absent.
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
