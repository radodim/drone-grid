import logging
import uuid

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.service.exceptions import (
    AppException,
    DuplicateDroneNameError,
    InvalidShareTokenError,
    InvalidTokenError,
    MediaServerError,
    NonExistentDroneError,
)

logger = logging.getLogger(__name__)


EXCEPTIONS_STATUS_MAP: dict[type[AppException], tuple[int, str]] = {
    DuplicateDroneNameError: (
        status.HTTP_409_CONFLICT,
        "A drone with this name already exists.",
    ),
    InvalidTokenError: (status.HTTP_401_UNAUTHORIZED, "Invalid token."),
    InvalidShareTokenError: (status.HTTP_404_NOT_FOUND, "Share link not found."),
    MediaServerError: (status.HTTP_500_INTERNAL_SERVER_ERROR, "Media server error."),
    NonExistentDroneError: (status.HTTP_404_NOT_FOUND, "Drone not found."),
}


def register_exceptions(app: FastAPI) -> None:
    for exc_class, (status_code, detail) in EXCEPTIONS_STATUS_MAP.items():
        app.add_exception_handler(exc_class, __build_handler(status_code, detail))
    # Anything unmapped is an unexpected fault: generic 500 + correlation id.
    app.add_exception_handler(
        Exception,
        __build_handler(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error."
        ),
    )


def __build_handler(status_code: int, detail: str):
    def handle(_: Request, exc: Exception) -> JSONResponse:
        error_id = uuid.uuid4().hex
        message = f"[{error_id}] {type(exc).__name__} ({status_code}): {exc}"
        if status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            logger.error(message, exc_info=exc)
        else:
            logger.warning(message)

        return JSONResponse(
            status_code=status_code,
            content={"detail": detail, "error_id": error_id},
        )

    return handle
