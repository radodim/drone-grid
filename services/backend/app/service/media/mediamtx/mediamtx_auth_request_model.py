from typing import Literal

from pydantic import BaseModel


# https://mediamtx.org/docs/other/authentication#external-http-server
class MediaMtxAuthRequestModel(BaseModel):
    user: str
    password: str
    token: str
    action: Literal["publish", "read"]
    path: str
    protocol: Literal["rtsp", "webrtc"]
