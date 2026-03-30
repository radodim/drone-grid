from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

from app.service.exceptions import MediaServerException, NonExistentDroneException

EXCEPTIONS_STATUS_MAP = {
    # media route
    MediaServerException: status.HTTP_500_INTERNAL_SERVER_ERROR,
    # drone route
    NonExistentDroneException: status.HTTP_404_NOT_FOUND,
}


def register_exceptions(app: FastAPI):
    for exc_class, status_code in EXCEPTIONS_STATUS_MAP.items():
        app.add_exception_handler(
            exc_class,
            lambda req, exc, sc=status_code: JSONResponse(
                status_code=sc, content={"detail": str(exc)}
            ),
        )
