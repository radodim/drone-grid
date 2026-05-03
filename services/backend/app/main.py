import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.error.handler import register_exceptions
from app.api.main import api_router
from app.config import GLOBAL_APP_SETTINGS
from app.service.messaging.messaging_service_factory import get_messaging_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with get_messaging_service() as messaging:
        app.state.messaging = messaging
        yield


__IS_LOCAL = GLOBAL_APP_SETTINGS.ENVIRONMENT == "local"


def __generate_operation_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


app = FastAPI(
    generate_unique_id_function=__generate_operation_id,
    title="Drone Grid API",
    description="Drone Grid API",
    openapi_url="/api/v1/openapi.json" if __IS_LOCAL else None,
    docs_url="/docs" if __IS_LOCAL else None,
    redoc_url="/redoc" if __IS_LOCAL else None,
    lifespan=lifespan,
)
app.include_router(api_router, prefix="/api/v1")
register_exceptions(app)

app.add_middleware(
    CORSMiddleware,  # CORS is a browser-only mechanism
    allow_origins=GLOBAL_APP_SETTINGS.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
