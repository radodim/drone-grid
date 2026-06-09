from typing import Annotated, Literal

from pydantic import BaseModel, Field, RootModel


class Axes(BaseModel):
    """Manual control stick values. Range-validated at the backend so invalid
    inputs from any UI client are rejected at the trust boundary instead of
    reaching the companion.
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


class Disarm(BaseModel):
    type: Literal["disarm"]


class ControlMessage(RootModel):
    """Discriminated union of every message the UI sends on the control
    WebSocket. The backend validates into this shape before publishing to
    NATS; the companion validates the same shape on consumption.
    """

    root: Annotated[
        ControlInput | Arm | Disarm,
        Field(discriminator="type"),
    ]
