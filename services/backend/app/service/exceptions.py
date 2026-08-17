class AppException(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# Media server
class MediaServerError(AppException):
    def __init__(self, message: str):
        super().__init__(message)


# Drone service
class NonExistentDroneError(AppException):
    def __init__(self, message: str):
        super().__init__(message)


class DuplicateDroneNameError(AppException):
    def __init__(self, message: str):
        super().__init__(message)


# Auth
class InvalidTokenError(AppException):
    """JWT failed validation. The message is the internal reason (safe to log,
    not to leak to clients — the exception handler returns a generic detail)."""

    def __init__(self, reason: str):
        super().__init__(reason)


# Share links
class InvalidShareTokenError(AppException):
    """Share token is missing, malformed, expired, or revoked. The handler
    returns a generic 404 — never reveal which check failed."""

    def __init__(self, reason: str):
        super().__init__(reason)
