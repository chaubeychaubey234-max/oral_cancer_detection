"""
Single call-site the rest of the backend uses for risk classification.

Same pattern as quality_client.py: tries a real `tobaccoshield_risk` package
(Member C's expected package name - confirm with Member C and adjust the
import below once their package exists), falls back to the bundled stub.
"""
import logging

from app.config import settings

logger = logging.getLogger("tobaccoshield.risk_client")

_real_module = None
_using_real = False

if settings.USE_REAL_RISK_MODULE:
    try:
        from tobaccoshield_risk import classify_risk as _real_classify  # type: ignore
        _real_module = _real_classify
        _using_real = True
        logger.info("Using REAL tobaccoshield_risk module (Member C).")
    except ImportError:
        logger.warning("tobaccoshield_risk not installed - using Member D's bundled risk stub.")

if not _using_real:
    from app.mocks.risk_stub import classify_risk as _stub_classify


def is_using_real_module() -> bool:
    return _using_real


def run_risk_classification(image_bytes: bytes, config: dict | None = None) -> dict:
    """Returns dict with risk_category, confidence, cannot_assess, heatmap_png_bytes, model_version, timestamp."""
    if _using_real:
        return _real_module(image_bytes, config=config)
    return _stub_classify(image_bytes, config=config)
