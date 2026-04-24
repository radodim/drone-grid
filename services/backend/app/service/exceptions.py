class AppException(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# Media server
class MediaServerException(AppException):
    def __init__(self, message: str):
        super().__init__(message)


# Drone service
class NonExistentDroneException(AppException):
    def __init__(self, message: str):
        super().__init__(message)


# Auth
class InvalidTokenError(AppException):
    """JWT failed validation. The message is the internal reason (safe to log,
    not to leak to clients — the exception handler returns a generic detail)."""

    def __init__(self, reason: str):
        super().__init__(reason)
