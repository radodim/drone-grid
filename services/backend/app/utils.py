import hashlib
from datetime import UTC, datetime


def get_utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
