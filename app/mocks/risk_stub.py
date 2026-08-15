"""
STUB for Member C's risk-classification model.

Member D defines this as the expected contract (no such contract existed
in the shared docs yet, so this doubles as a proposal you can hand to
Member C - they can literally copy this docstring into their own module).

Expected real contract:

    classify_risk(image_input, config=None) -> {
        "risk_category": "low" | "medium" | "high" | "cannot_assess",
        "confidence": float,              # 0.0-1.0
        "cannot_assess": bool,
        "cannot_assess_reason": str | None,
        "heatmap_png_bytes": bytes | None,  # suspicious-region overlay, same
                                             # dimensions as input image
        "model_version": str,
        "timestamp": ISO8601 string,
    }

This stub never produces a real diagnosis - it deterministically hashes
image bytes into a pseudo-random-but-repeatable risk category so that
integration tests are reproducible, and draws a trivial "heatmap" (a
translucent circle) so Member D's dashboard rendering can be tested too.
"""
import hashlib
import io
from datetime import datetime, timezone

from PIL import Image, ImageDraw

MODEL_VERSION = "0.0.1-stub"

CATEGORIES = ["low", "medium", "high"]


def _draw_fake_heatmap(image_bytes: bytes, intensity: float) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size
    cx, cy = w // 2, h // 2
    r = int(min(w, h) * (0.15 + 0.15 * intensity))
    alpha = int(90 + 80 * intensity)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 0, 0, alpha))
    combined = Image.alpha_composite(img, overlay).convert("RGB")
    buf = io.BytesIO()
    combined.save(buf, format="PNG")
    return buf.getvalue()


def classify_risk(image_input, config=None) -> dict:
    if isinstance(image_input, (bytes, bytearray)):
        image_bytes = bytes(image_input)
    elif isinstance(image_input, str):
        with open(image_input, "rb") as f:
            image_bytes = f.read()
    else:
        raise TypeError("risk_stub expects bytes or a file path")

    digest = hashlib.sha256(image_bytes).hexdigest()
    seed = int(digest[:8], 16)

    # ~5% "cannot assess" rate, mirroring a real model's low-confidence fallback
    if seed % 20 == 0:
        return {
            "risk_category": "cannot_assess",
            "confidence": round(0.2 + (seed % 100) / 500.0, 2),
            "cannot_assess": True,
            "cannot_assess_reason": "Model confidence below safe threshold for this image.",
            "heatmap_png_bytes": None,
            "model_version": MODEL_VERSION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    category = CATEGORIES[seed % 3]
    confidence = round(0.55 + (seed % 1000) / 2222.0, 2)  # ~0.55-1.0
    intensity = {"low": 0.2, "medium": 0.55, "high": 0.9}[category]

    heatmap_bytes = _draw_fake_heatmap(image_bytes, intensity)

    return {
        "risk_category": category,
        "confidence": confidence,
        "cannot_assess": False,
        "cannot_assess_reason": None,
        "heatmap_png_bytes": heatmap_bytes,
        "model_version": MODEL_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
