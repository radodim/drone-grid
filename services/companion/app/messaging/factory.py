from config import Settings
from messaging.client import MessagingClient
from messaging.drone_grid.drone_grid import DroneGridMessagingClient


def build_messaging_client(settings: Settings) -> MessagingClient:
    return DroneGridMessagingClient(
        url=settings.messaging_url,
        drone_id=settings.drone_id,
        drone_secret=settings.drone_secret,
    )
