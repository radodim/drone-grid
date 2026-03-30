from fastapi import APIRouter

from app.api.routes import drone, media, user

# TODO: extract business logic from routers to service classes

api_router = APIRouter()
api_router.include_router(user.router)
api_router.include_router(drone.router)
api_router.include_router(media.router)
