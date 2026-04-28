from config import DroneGridMessaging, NatsMessaging, Settings
from messaging.client import MessagingClient
from messaging.drone_grid.drone_grid import DroneGridMessagingClient
from messaging.nats.nats import NatsMessagingClient


def build_messaging_client(settings: Settings) -> MessagingClient:
    if isinstance(settings.messaging, NatsMessaging):
        return NatsMessagingClient(url=settings.messaging.url)
    if isinstance(settings.messaging, DroneGridMessaging):
        return DroneGridMessagingClient(
            url=settings.messaging.url,
            drone_id=settings.drone_id,
            drone_secret=settings.drone_secret,
        )
    raise RuntimeError(f"Unsupported messaging config: {settings.messaging}")
