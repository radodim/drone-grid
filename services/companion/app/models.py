from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel


# ── Inbound: control messages from the UI, via the backend ─────────────────
#
# Discriminated on `t`. Each variant carries only the fields that variant
# actually needs, so adding a new command is a new class plus a match arm —
# no sentinel checks or optional-field gymnastics.


class ControlInput(BaseModel):
    t: Literal["c"]
    a: tuple[float, float, float, float]  # [pitch, roll, throttle, yaw]


class Arm(BaseModel):
    t: Literal["arm"]


class Takeoff(BaseModel):
    t: Literal["takeoff"]


class Land(BaseModel):
    t: Literal["land"]


class Disarm(BaseModel):
    t: Literal["disarm"]


class ControlMessage(RootModel):
    root: Annotated[
        ControlInput | Arm | Takeoff | Land | Disarm,
        Field(discriminator="t"),
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
