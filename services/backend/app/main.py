import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.api.error.handler import register_exceptions
from app.api.main import api_router
from app.data.db.session import create_db_and_tables

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
)


# TODO: See how this works
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="Drone Grid API",
    description="Drone Grid API",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)
app.include_router(api_router, prefix="/api/v1")
register_exceptions(app)

# TODO: See how this should be configured for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: Remove OpenAPI JSON endpoint for production
