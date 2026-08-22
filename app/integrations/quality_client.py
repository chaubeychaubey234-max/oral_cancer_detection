"""
Single call-site the rest of the backend uses for image quality checks.

Tries to import Member B's real `tobaccoshield_quality` package first
(exactly the interface documented in INTEGRATION_GUIDE.md: `check_image_quality`
+ `QualityConfig`). If it isn't installed yet, or USE_REAL_QUALITY_MODULE=false,
falls back to the bundled stub in app/mocks/quality_stub.py.

Nothing else in the codebase should import tobaccoshield_quality or the
stub directly - always go through `run_quality_check()` below, so that
dropping Member B's real package into the repo/venv is a zero-code-change
integration.
"""
import logging

from app.config import settings

logger = logging.getLogger("tobaccoshield.quality_client")

_real_module = None
_using_real = False

if settings.USE_REAL_QUALITY_MODULE:
    try:
        from tobaccoshield_quality import check_image_quality as _real_check, QualityConfig  # type: ignore
        _real_module = _real_check
        _using_real = True
        logger.info("Using REAL tobaccoshield_quality module (Member B).")
    except ImportError:
        logger.warning("tobaccoshield_quality not installed - using Member D's bundled quality stub.")

if not _using_real:
    from app.mocks.quality_stub import check_image_quality as _stub_check


def is_using_real_module() -> bool:
    return _using_real


def run_quality_check(image_bytes: bytes, config: dict | None = None) -> dict:
    """Returns the standardized contract dict from INTERFACE_CONTRACT.md.

    Always guarantees a "processed_image_bytes" key is present (falling back
    to the raw capture if a connected quality module - real or stub - didn't
    supply one), so callers never need defensive .get() chains.
    """
    if _using_real:
        qconfig = QualityConfig(**config) if config else None
        result = _real_module(image_bytes, config=qconfig)
    else:
        result = _stub_check(image_bytes, config=config)

    result.setdefault("processed_image_bytes", None)
    if result["pass"] and result["processed_image_bytes"] is None:
        logger.warning(
            "Quality module passed an image but returned no processed_image_bytes; "
            "falling back to the raw capture for the risk model. Confirm Member B's "
            "real package implements preprocessing per INTERFACE_CONTRACT.md."
        )
        result["processed_image_bytes"] = image_bytes
    return result
