from pydantic import BaseModel


class DroneCreate(BaseModel):
    name: str
