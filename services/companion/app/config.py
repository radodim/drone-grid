from typing import Annotated, Literal

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class NoVideo(BaseModel):
    source: Literal["none"] = "none"


class RpicamVideo(BaseModel):
    source: Literal["rpicam"]
    width: int = 960
    height: int = 720
    fps: int = 30
    bitrate: str = "2000k"


class GazeboVideo(BaseModel):
    source: Literal["gazebo"]
    port: int = 5600


VideoConfig = Annotated[
    NoVideo | RpicamVideo | GazeboVideo,
    Field(discriminator="source"),
]


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

    mavsdk_connection_url: str
    drone_id: str
    drone_secret: str
    messaging_system_url: str
    media_server_url: str

    video: VideoConfig = NoVideo()


GLOBAL_APP_SETTINGS = Settings()  # type: ignore[call-arg]
