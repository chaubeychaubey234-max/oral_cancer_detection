import base64
from datetime import datetime, timezone


def decode_image_base64(data: str) -> bytes:
    """Accepts either a raw base64 string or a data URI (data:image/jpeg;base64,...)."""
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]
    return base64.b64decode(data)


def as_naive_utc(dt: datetime | None) -> datetime | None:
    """
    SQLite has no native timezone-aware DATETIME type - values written as
    aware datetimes come back naive on read. Client clocks sent over the
    wire (e.g. "...Z" / "+00:00" ISO strings) parse as timezone-aware.
    Comparing an aware and a naive datetime raises TypeError, so every
    last-write-wins comparison in sync.py normalizes through this first.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt