from datetime import datetime
from enum import Enum

from pydantic import BaseModel

# This schema is duplicated at services/companion/app/models.py.
# If you change it here, change it there.


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
    READY = "ready"


class Telemetry(BaseModel):
    companion_state: CompanionState
    companion_state_timestamp: datetime
    mavlink_telemetry: MavlinkTelemetry | None
