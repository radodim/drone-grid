from datetime import UTC, datetime


def get_utcnow() -> datetime:
    """Current UTC time as a tz-less (Python calls it "naive") datetime, to
    match the DateTime columns and keep timestamp comparisons consistent."""
    return datetime.now(UTC).replace(tzinfo=None)
