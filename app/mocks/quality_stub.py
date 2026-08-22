"""
STUB for Member B's `tobaccoshield_quality.check_image_quality`.

This exists purely so Member D can build and test the full pipeline
(upload -> quality check -> preprocessing -> risk model -> case status ->
dashboard) *before* Member B's real package lands in the repo.

It follows the FROZEN contract in INTERFACE_CONTRACT.md (see that file for
the canonical spec), so swapping this stub for the real package later is a
one-line change in app/integrations/quality_client.py - nothing else in the
codebase needs to know the difference.

Per the current team scope, Member B owns the WHOLE flow from click to
AI-ready image:
    CLICK -> position -> framing -> blur -> lighting -> glare
          -> quality decision -> preprocessing -> AI-ready image
So on a pass, this stub also returns "processed_image_bytes" - a cropped,
resized, normalized image that Member C's model should run on, NOT the raw
capture. Member D's pipeline (app/routers/cases.py::_run_pipeline) always
sends whatever's in processed_image_bytes to the risk classifier, falling
back to the raw upload only if a quality module (real or stub) doesn't
supply one.

The heuristics themselves are intentionally crude (mean brightness + a
cheap Laplacian-variance blur proxy via PIL) - not meant to be accurate,
only to exercise every downstream code path (retake prompts, status
transitions, dashboard badges, preprocessing hand-off) realistically.
"""
from datetime import datetime, timezone
import io

import numpy as np
from PIL import Image, ImageOps

MODULE_VERSION = "0.0.1-stub"

BLUR_THRESHOLD = 80.0
BRIGHTNESS_MIN = 40.0
BRIGHTNESS_MAX = 215.0
MAX_GLARE_AREA_PCT = 6.0
MIN_FRAMING_CONFIDENCE = 0.50

# Target size Member C's model is assumed to expect. Change this the moment
# Member C confirms their real input size and note it in INTERFACE_CONTRACT.md.
AI_READY_SIZE = (224, 224)


def _load_gray(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    return np.asarray(img, dtype=np.float32)


def _blur_score(gray: np.ndarray) -> float:
    # Cheap Laplacian-variance approximation without OpenCV/SciPy dependency.
    lap = (
        -4 * gray
        + np.roll(gray, 1, axis=0) + np.roll(gray, -1, axis=0)
        + np.roll(gray, 1, axis=1) + np.roll(gray, -1, axis=1)
    )
    return float(np.var(lap))


def _framing_confidence(image_bytes: bytes) -> float:
    # Crude proxy: fraction of pixels in the central 60% ROI that look
    # "mucosa-pink" (high R, mid G, low-mid B in RGB terms).
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    box = (int(w * 0.2), int(h * 0.2), int(w * 0.8), int(h * 0.8))
    roi = np.asarray(img.crop(box), dtype=np.float32)
    r, g, b = roi[..., 0], roi[..., 1], roi[..., 2]
    mucosa_like = (r > 140) & (r > g + 20) & (g > b - 10)
    return float(np.clip(mucosa_like.mean() * 1.3, 0.0, 1.0))


def _glare_pct(image_bytes: bytes) -> float:
    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    arr = np.asarray(img, dtype=np.float32)
    return float((arr > 245).mean() * 100.0)


def _make_ai_ready_image(image_bytes: bytes) -> bytes:
    """
    Crop to the central mucosa ROI, resize to AI_READY_SIZE, and normalize
    contrast - a stand-in for whatever real preprocessing Member B settles
    on (their real package can crop tighter around a detected mucosa region,
    apply color-constancy correction, etc). The exact algorithm doesn't
    matter for Member D's purposes - only that *some* processed image comes
    back and gets threaded through to Member C instead of the raw capture.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    box = (int(w * 0.15), int(h * 0.15), int(w * 0.85), int(h * 0.85))
    cropped = img.crop(box)
    resized = cropped.resize(AI_READY_SIZE, Image.LANCZOS)
    normalized = ImageOps.autocontrast(resized, cutoff=1)
    buf = io.BytesIO()
    normalized.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def check_image_quality(image_input, config=None) -> dict:
    """Signature-compatible stub for tobaccoshield_quality.check_image_quality.

    image_input: raw bytes, base64 string, file path, or numpy array (bytes
    and file-path are supported here; base64/ndarray callers should decode
    before calling the stub, matching how quality_client.py normalizes input).
    """
    if isinstance(image_input, (bytes, bytearray)):
        image_bytes = bytes(image_input)
    elif isinstance(image_input, str):
        with open(image_input, "rb") as f:
            image_bytes = f.read()
    else:
        raise TypeError("quality_stub expects bytes or a file path")

    gray = _load_gray(image_bytes)
    blur = _blur_score(gray)
    brightness = float(gray.mean())
    glare = _glare_pct(image_bytes)
    framing = _framing_confidence(image_bytes)

    cfg = config or {}
    blur_th = cfg.get("blur_threshold", BLUR_THRESHOLD)
    b_min = cfg.get("brightness_min", BRIGHTNESS_MIN)
    b_max = cfg.get("brightness_max", BRIGHTNESS_MAX)
    glare_max = cfg.get("max_glare_area_pct", MAX_GLARE_AREA_PCT)
    framing_min = cfg.get("min_framing_confidence", MIN_FRAMING_CONFIDENCE)

    failed = []
    if blur < blur_th:
        failed.append("blur")
    if brightness < b_min:
        failed.append("underexposed")
    elif brightness > b_max:
        failed.append("overexposed")
    if glare > glare_max:
        failed.append("glare")
    if framing < framing_min:
        failed.append("bad_framing")

    passed = len(failed) == 0

    return {
        "pass": passed,
        "reason": failed[0] if failed else None,
        "all_failed_reasons": failed,
        "scores": {
            "blur_score": round(blur, 2),
            "brightness_score": round(brightness, 2),
            "glare_area_pct": round(glare, 2),
            "framing_confidence": round(framing, 2),
        },
        "processed_image_bytes": _make_ai_ready_image(image_bytes) if passed else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "module_version": MODULE_VERSION,
    }
