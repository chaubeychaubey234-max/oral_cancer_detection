"""
Core Entry-Point Engine for TobaccoShield Image Quality Assessment.
Executes all 4 quality checks, evaluates pass/fail status, determines failure reason priority,
and formats results according to the agreed multi-team contract.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .checks import check_blur, check_exposure, check_framing, check_glare
from .config import QualityConfig
from .preprocessor import ImageInputType, load_image_to_bgr

MODULE_VERSION = "1.0.0"


def check_image_quality(
    image_input: ImageInputType, config: Optional[QualityConfig] = None
) -> Dict[str, Any]:
    """
    Main entry-point function for TobaccoShield image quality inspection.
    
    Members A (Mobile App), C (AI Model Pipeline), and D (Backend Server) should only ever
    call this single function.

    Args:
        image_input (Union[bytes, bytearray, str, Path, np.ndarray]):
            Image payload (file path, raw bytes, base64 string, or BGR numpy array).
        config (Optional[QualityConfig]): Custom thresholds configuration.
            If None, uses default named constants.

    Returns:
        Dict[str, Any]: Standardized JSON-serializable dictionary matching team contract:
        {
          "pass": bool,
          "reason": "blur" | "underexposed" | "overexposed" | "glare" | "bad_framing" | null,
          "scores": {
            "blur_score": float,
            "brightness_score": float,
            "glare_area_pct": float,
            "framing_confidence": float
          },
          "timestamp": ISO8601 string,
          "module_version": string
        }

    Raises:
        ValueError: If input format cannot be loaded into a valid BGR OpenCV image matrix.
    """
    if config is None:
        config = QualityConfig()

    # 1. Load and normalize input image into 3-channel BGR matrix
    image_bgr = load_image_to_bgr(image_input)

    # 2. Run ALL 4 quality checks to compute complete set of scores regardless of pass/fail
    blur_score, pass_blur = check_blur(
        image_bgr, threshold=config.blur_threshold
    )
    
    brightness_score, exp_verdict, pass_exposure = check_exposure(
        image_bgr,
        min_brightness=config.brightness_min,
        max_brightness=config.brightness_max,
    )
    
    glare_area_pct, pass_glare = check_glare(
        image_bgr, max_glare_pct=config.max_glare_area_pct
    )
    
    framing_confidence, pass_framing = check_framing(
        image_bgr, min_confidence=config.min_framing_confidence
    )

    # 3. Determine failure reason reflecting the FIRST failing check only in priority order
    reason: Optional[str] = None
    if not pass_blur:
        reason = "blur"
    elif exp_verdict == "underexposed":
        reason = "underexposed"
    elif exp_verdict == "overexposed":
        reason = "overexposed"
    elif not pass_glare:
        reason = "glare"
    elif not pass_framing:
        reason = "bad_framing"

    overall_pass: bool = reason is None

    # 4. Construct standardized response payload matching team contract
    timestamp_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "pass": overall_pass,
        "reason": reason,
        "scores": {
            "blur_score": float(blur_score),
            "brightness_score": float(brightness_score),
            "glare_area_pct": float(glare_area_pct),
            "framing_confidence": float(framing_confidence),
        },
        "timestamp": timestamp_iso,
        "module_version": MODULE_VERSION,
    }
