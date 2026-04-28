from app.config import GLOBAL_APP_SETTINGS
from app.service.messaging.messaging_service import MessagingService
from app.service.messaging.nats.nats_messaging_service import NatsMessagingService


def get_messaging_service() -> MessagingService:
    # If adding another messaging implementation extend this factory and
    # add an env var (MESSAGING_SYSTEM, default NATS).
    return NatsMessagingService(GLOBAL_APP_SETTINGS.NATS_URL)
