from fastapi import APIRouter

from app.api.routes import (
    companion,
    control,
    drone,
    health,
    media,
    share,
    telemetry,
    user,
)

api_router = APIRouter()
api_router.include_router(user.router)
api_router.include_router(drone.router)
api_router.include_router(media.router)
api_router.include_router(control.router)
api_router.include_router(telemetry.router)
api_router.include_router(companion.router)
api_router.include_router(share.router)
api_router.include_router(health.router)
