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
