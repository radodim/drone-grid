from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel

# TODO: Create a lib containing these type definitions with next release


class Axes(BaseModel):
    pitch: float = Field(ge=-1.0, le=1.0)
    roll: float = Field(ge=-1.0, le=1.0)
    throttle: float = Field(ge=0.0, le=1.0)  # multicopter convention: 0 idle, 1 full
    yaw: float = Field(ge=-1.0, le=1.0)


class ControlInput(BaseModel):
    type: Literal["control_input"]
    axes: Axes


class Arm(BaseModel):
    type: Literal["arm"]


class Disarm(BaseModel):
    type: Literal["disarm"]


class ControlMessage(RootModel):
    root: Annotated[
        ControlInput | Arm | Disarm,
        Field(discriminator="type"),
    ]


# Telemetry models


class Position(BaseModel):
    lat: float | None
    lon: float | None
    rel_alt: float | None
    abs_alt: float | None


class Gps(BaseModel):
    num_satellites: int | None
    fix_type: str | None


class Health(BaseModel):
    is_gyrometer_calibrated: bool | None
    is_accelerometer_calibrated: bool | None
    is_magnetometer_calibrated: bool | None
    is_local_position_ok: bool | None
    is_global_position_ok: bool | None
    is_home_position_ok: bool | None
    is_armable: bool | None


class MavlinkTelemetry(BaseModel):
    flight_controller_last_seen: datetime
    is_armed: bool
    is_in_air: bool
    flight_mode: str
    battery_percentage: float | None
    flight_time_remaining: float | None
    position: Position | None
    gps: Gps | None
    health: Health | None


class CompanionState(str, Enum):
    CONNECTING = "connecting"
    CALIBRATING = "calibrating"
    READY = "ready"


class Telemetry(BaseModel):
    companion_state: CompanionState
    companion_state_timestamp: datetime
    mavlink_telemetry: MavlinkTelemetry | None
