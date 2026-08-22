import base64
import io
from datetime import datetime, timezone

from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException


def decode_image_base64(data: str) -> bytes:
    """Accepts either a raw base64 string or a data URI (data:image/jpeg;base64,...)."""
    if "," in data and data.strip().lower().startswith("data:"):
        data = data.split(",", 1)[1]
    try:
        return base64.b64decode(data, validate=True)
    except Exception as e:
        raise HTTPException(400, f"image_base64 is not valid base64: {e}")


def validate_image_bytes(image_bytes: bytes) -> None:
    """
    Raises a clean 400 for an unreadable/corrupt/empty upload instead of
    letting it surface as an unhandled 500 three layers deep inside the
    quality-check stub or real module.
    """
    if not image_bytes:
        raise HTTPException(400, "uploaded image is empty")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
    except UnidentifiedImageError:
        raise HTTPException(400, "uploaded file is not a readable image")
    except Exception as e:
        raise HTTPException(400, f"uploaded image could not be processed: {e}")


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
