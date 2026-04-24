from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

from app.service.exceptions import (
    AppException,
    InvalidTokenError,
    MediaServerException,
    NonExistentDroneException,
)

# status code + optional client-facing detail.
# - detail=None → expose str(exc) (safe for domain errors with readable messages).
# - detail="..." → use the fixed string; str(exc) is for logs only (use this for
#   anything that could leak sensitive info, e.g. auth failure reasons).
EXCEPTIONS_STATUS_MAP: dict[type[AppException], tuple[int, str | None]] = {
    # media route
    MediaServerException: (status.HTTP_500_INTERNAL_SERVER_ERROR, None),
    # drone route
    NonExistentDroneException: (status.HTTP_404_NOT_FOUND, None),
    # auth — never expose the underlying reason ("token expired", "invalid
    # signature", …) to the client; keep it in logs only.
    InvalidTokenError: (status.HTTP_401_UNAUTHORIZED, "Invalid token."),
}


def register_exceptions(app: FastAPI):
    for exc_class, (status_code, client_detail) in EXCEPTIONS_STATUS_MAP.items():
        app.add_exception_handler(
            exc_class,
            lambda req, exc, sc=status_code, detail=client_detail: JSONResponse(
                status_code=sc,
                content={"detail": detail if detail is not None else str(exc)},
            ),
        )
