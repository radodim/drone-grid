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
    lat: float
    lon: float
    alt: float


class Telemetry(BaseModel):
    armed: bool
    mode: str
    battery: float | None
    position: Position
