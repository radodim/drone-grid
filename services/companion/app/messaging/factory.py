from config import Settings
from messaging.client import MessagingClient
from messaging.nats.nats import NatsMessagingClient


def build_messaging_client(settings: Settings) -> MessagingClient:
    # Only NATS is implemented. If additional brokers appear, promote this
    # to dispatching on a MessagingConfig discriminated union in config.py
    # analogous to VideoConfig.
    #
    # Auth is intentionally not wired yet. The end state is a NATS auth
    # callout to the backend that validates a per-drone JWT; once that's
    # in place, pass settings.drone_id / settings.drone_secret here.
    return NatsMessagingClient(url=settings.messaging_system_url)
