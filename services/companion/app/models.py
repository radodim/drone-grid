from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel

# ── Inbound: control messages from the UI, via the backend ─────────────────
#
# Discriminated on `type`. Each variant carries only the fields that variant
# actually needs, so adding a new command is a new class plus a match arm —
# no sentinel checks or optional-field gymnastics.
#
# This schema is duplicated at services/backend/app/data/control/model/message.py.
# If you change it here, change it there.


class Axes(BaseModel):
    """Manual control stick values. Range constraints are enforced at the
    backend (trust boundary); the companion re-validates as defense in depth.
    """

    pitch: float = Field(ge=-1.0, le=1.0)
    roll: float = Field(ge=-1.0, le=1.0)
    throttle: float = Field(ge=0.0, le=1.0)  # multicopter convention: 0 idle, 1 full
    yaw: float = Field(ge=-1.0, le=1.0)


class ControlInput(BaseModel):
    type: Literal["control_input"]
    axes: Axes


class Arm(BaseModel):
    type: Literal["arm"]


class Takeoff(BaseModel):
    type: Literal["takeoff"]


class Land(BaseModel):
    type: Literal["land"]


class Disarm(BaseModel):
    type: Literal["disarm"]


class ControlMessage(RootModel):
    root: Annotated[
        ControlInput | Arm | Takeoff | Land | Disarm,
        Field(discriminator="type"),
    ]


# ── Outbound: telemetry to the UI, via the backend ─────────────────────────


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
