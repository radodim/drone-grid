class DroneException(Exception):
    default_message = "A drone error occurred."

    def __init__(
        self,
        message: str | None = None,
        cause: Exception | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.cause = cause
        super().__init__(self.message)
        if cause is not None:
            self.__cause__ = cause

    def __str__(self) -> str:
        if self.cause is not None:
            return f"{self.message} (caused by: {self.cause!r})"
        return self.message


class DroneInitializationException(DroneException):
    default_message = "Drone initialization failed."


class DroneActionException(DroneException):
    default_message = "Drone action failed."
