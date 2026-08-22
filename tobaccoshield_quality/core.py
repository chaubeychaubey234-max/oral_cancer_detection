"""
Core Entry-Point Engine for TobaccoShield Image Quality Assessment (Member B).

Orchestrates the complete 7-check quality assessment pipeline:
    1. Positioning           — centring of oral cavity in frame
    2. Framing               — composite buccal mucosa presence vs skin/teeth/shadows
    3. Buccal Mucosa         — minimum required inner mucosal tissue presence
    4. Distance / Coverage   — camera distance (too close / too far)
    5. Blur Detection        — Laplacian variance sharpness check
    6. Lighting / Exposure   — luminance mean & spatial unevenness check
    7. Glare / Reflection    — specular reflection coverage check

Followed by quality scoring, PASS/FAIL determination, human-readable reason generation,
and post-processing (crop → resize → enhance → base64 JPEG) ONLY for quality-passed images.

Guarantees that unusable images are rejected with retake guidance and NEVER reach Member C.
"""

import base64
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from .checks import (
    build_shared_features,
    check_blur,
    check_buccal_mucosa,
    check_distance,
    check_exposure,
    check_framing,
    check_glare,
    check_lighting,
    check_positioning,
)
from .config import QUALITY_SCORE_WEIGHTS, QualityConfig
from .postprocessor import (
    crop_to_oral_region,
    encode_to_base64,
    enhance_image,
    resize_image,
)
from .preprocessor import ImageInputType, load_image_to_bgr

MODULE_VERSION = "1.0.0"

# ──────────────────────────────────────────────────────────────────────────────
# Human-readable failure prompts for Member A UI / Retake guidance
# ──────────────────────────────────────────────────────────────────────────────
_HUMAN_MESSAGES: Dict[str, str] = {
    "bad_positioning": "The oral area is not properly positioned. Please centre the camera on the inner cheek.",
    "bad_framing":     "The oral region is poorly framed. Keep the camera steady and focus on the inner mouth area.",
    "no_mucosa":       "The inner oral tissue (buccal mucosa) is not clearly visible. Open wider and aim inside the cheek.",
    "too_far":         "Camera is too far away. Move closer to fill the frame with the oral tissue.",
    "too_close":        "Camera is too close. Move back slightly so the full oral region is visible.",
    "blur":            "Image is too blurry. Hold the phone steady and tap to focus before capturing.",
    "underexposed":    "Image is too dark. Move to a well-lit area or turn on flash.",
    "overexposed":     "Image is too bright. Reduce flash or move away from direct light.",
    "uneven_lighting": "Lighting is uneven with harsh shadows. Reposition light source for balanced illumination.",
    "glare":           "Too much reflection is covering the oral area. Change camera angle slightly and retake.",
    "low_quality":     "Overall image quality is insufficient for clinical assessment. Please retake the photo.",
}


def compute_quality_score(
    scores: Dict[str, float],
    pass_dict: Dict[str, bool],
    config: QualityConfig,
) -> float:
    """
    Calculates an overall quality score strictly in [0.0, 1.0].

    The score represents IMAGE QUALITY ONLY — it does NOT represent cancer risk,
    lesion probability, or disease confidence.

    Normalises per-check metrics into individual [0, 1] sub-scores and computes a
    weighted linear sum using QUALITY_SCORE_WEIGHTS.

    Args:
        scores: Dict of raw check metrics.
        pass_dict: Dict of pass/fail booleans for each check.
        config: QualityConfig instance for thresholds.

    Returns:
        float: Overall quality score rounded to 2 decimal places.
    """
    # Sub-score 1: Positioning (already 0..1)
    s_pos = float(np.clip(scores.get("positioning_score", 0.0), 0.0, 1.0))

    # Sub-score 2: Framing (already 0..1)
    s_frame = float(np.clip(scores.get("framing_confidence", 0.0), 0.0, 1.0))

    # Sub-score 3: Buccal Mucosa ratio (target ~0.35+)
    s_mucosa = float(np.clip(scores.get("mucosa_ratio", 0.0) / 0.35, 0.0, 1.0))

    # Sub-score 4: Distance / Coverage (penalise extremes)
    cov = scores.get("coverage_ratio", 0.0)
    if cov < config.min_coverage_ratio:
        s_dist = max(0.0, cov / config.min_coverage_ratio)
    elif cov > config.max_coverage_ratio:
        s_dist = max(0.0, (1.0 - cov) / (1.0 - config.max_coverage_ratio))
    else:
        s_dist = 1.0

    # Sub-score 5: Blur (Laplacian variance target ~300+ for 1.0 score)
    blur_val = scores.get("blur_score", 0.0)
    s_blur = float(np.clip(blur_val / 300.0, 0.0, 1.0))

    # Sub-score 6: Lighting (ideal brightness ~128)
    b_val = scores.get("brightness_score", 0.0)
    b_diff = abs(b_val - 128.0)
    s_light = float(np.clip(1.0 - (b_diff / 100.0), 0.0, 1.0))

    # Sub-score 7: Glare (0% glare = 1.0, max_glare_pct = 0.0)
    g_val = scores.get("glare_area_pct", 0.0)
    s_glare = float(np.clip(1.0 - (g_val / max(config.max_glare_area_pct, 1.0)), 0.0, 1.0))

    # Weighted linear combination
    weights = QUALITY_SCORE_WEIGHTS
    total_score = (
        weights["positioning"]       * s_pos +
        weights["framing"]           * s_frame +
        weights["buccal_mucosa"]     * s_mucosa +
        weights["distance_coverage"] * s_dist +
        weights["blur"]              * s_blur +
        weights["lighting"]          * s_light +
        weights["glare"]             * s_glare
    )

    return float(round(np.clip(total_score, 0.0, 1.0), 2))


def check_image_quality(
    image_input: ImageInputType, config: Optional[QualityConfig] = None
) -> Dict[str, Any]:
    """
    Single entry-point interface for Member B image quality assessment & preprocessing.

    Runs 7 sequential quality checks, evaluates overall quality score, determines
    PASS/FAIL status, generates human-readable retake prompts, and applies post-processing
    (crop → resize → enhance → base64 JPEG) ONLY for PASS images.

    Args:
        image_input: Image payload — file path, bytes, base64 string, or BGR numpy array.
        config: Optional QualityConfig for threshold customization.

    Returns:
        Dict adhering to both team integration contract and Member B spec:
        {
          "passed": bool,
          "pass": bool,                      # legacy alias for Member D backend
          "quality_score": float,            # 0.00 to 1.00 (image quality only)
          "reason": str | None,              # primary failure code or None
          "human_reason": str | None,        # human-readable retake instructions
          "all_failed_reasons": list[str],   # all failed check codes
          "checks": {                        # per-check pass/fail status
              "positioning": "pass" | "fail",
              "framing": "pass" | "fail",
              "buccal_mucosa": "pass" | "fail",
              "distance_coverage": "pass" | "fail",
              "blur": "pass" | "fail",
              "lighting": "pass" | "fail",
              "glare": "pass" | "fail"
          },
          "scores": {                        # raw numeric metrics
              "blur_score": float,
              "brightness_score": float,
              "glare_area_pct": float,
              "framing_confidence": float,
              "positioning_score": float,
              "mucosa_ratio": float,
              "coverage_ratio": float,
              "lighting_unevenness": float
          },
          "ai_ready_image": str | None,      # base64 JPEG string (PASS only)
          "timestamp": str,
          "module_version": str
        }
    """
    if config is None:
        config = QualityConfig()

    # Step 0: Load image into BGR numpy matrix
    image_bgr = load_image_to_bgr(image_input)

    # Pre-compute shared YCrCb mucosa/skin/teeth features once
    shared = build_shared_features(image_bgr)

    # ── Execute 7 Quality Checks ──────────────────────────────────────────────

    # 1. Positioning Check
    pos_score, pass_pos = check_positioning(
        image_bgr, shared=shared, min_score=config.min_positioning_score
    )

    # 2. Framing Check
    framing_conf, pass_framing = check_framing(
        image_bgr, shared=shared, min_confidence=config.min_framing_confidence
    )

    # 3. Buccal Mucosa Detection
    mucosa_ratio, pass_mucosa = check_buccal_mucosa(
        image_bgr, shared=shared, min_ratio=config.min_buccal_mucosa_ratio
    )

    # 4. Distance / Coverage Check
    cov_ratio, dist_verdict, pass_dist = check_distance(
        image_bgr,
        shared=shared,
        min_coverage=config.min_coverage_ratio,
        max_coverage=config.max_coverage_ratio,
    )

    # 5. Blur Detection
    blur_score, pass_blur = check_blur(
        image_bgr, threshold=config.blur_threshold
    )

    # 6. Lighting / Exposure Check
    brightness_score, unevenness_score, lighting_verdict, pass_lighting = check_lighting(
        image_bgr,
        shared=shared,
        min_brightness=config.brightness_min,
        max_brightness=config.brightness_max,
        max_unevenness=config.lighting_unevenness_max,
    )

    # 7. Glare / Reflection Detection
    glare_pct, pass_glare = check_glare(
        image_bgr, max_glare_pct=config.max_glare_area_pct
    )

    # Collect per-check numeric metrics
    scores = {
        "blur_score":          float(blur_score),
        "brightness_score":    float(brightness_score),
        "glare_area_pct":      float(glare_pct),
        "framing_confidence":  float(framing_conf),
        "positioning_score":   float(pos_score),
        "mucosa_ratio":        float(mucosa_ratio),
        "coverage_ratio":      float(cov_ratio),
        "lighting_unevenness": float(unevenness_score),
    }

    # Per-check PASS / FAIL string map
    checks = {
        "positioning":       "pass" if pass_pos else "fail",
        "framing":           "pass" if pass_framing else "fail",
        "buccal_mucosa":     "pass" if pass_mucosa else "fail",
        "distance_coverage": "pass" if pass_dist else "fail",
        "blur":              "pass" if pass_blur else "fail",
        "lighting":          "pass" if pass_lighting else "fail",
        "glare":             "pass" if pass_glare else "fail",
    }

    pass_dict = {
        "positioning":       pass_pos,
        "framing":           pass_framing,
        "buccal_mucosa":     pass_mucosa,
        "distance_coverage": pass_dist,
        "blur":              pass_blur,
        "lighting":          pass_lighting,
        "glare":             pass_glare,
    }

    # Calculate overall image quality score
    quality_score = compute_quality_score(scores, pass_dict, config)

    # Build list of all failed reason codes in contract priority order
    all_failed_reasons: List[str] = []

    # Priority order for failure reasons:
    # blur -> lighting -> glare -> distance -> mucosa -> positioning -> framing
    if not pass_blur:
        all_failed_reasons.append("blur")

    if not pass_lighting:
        if lighting_verdict in ("underexposed", "overexposed", "uneven_lighting"):
            all_failed_reasons.append(lighting_verdict)
        else:
            all_failed_reasons.append("underexposed")

    if not pass_glare:
        all_failed_reasons.append("glare")

    if not pass_dist:
        all_failed_reasons.append(dist_verdict)  # "too_far" or "too_close"

    if not pass_mucosa:
        all_failed_reasons.append("no_mucosa")

    if not pass_pos:
        all_failed_reasons.append("bad_positioning")

    if not pass_framing:
        all_failed_reasons.append("bad_framing")

    # Overall PASS requires ALL individual checks to pass AND overall quality score >= min_quality_score
    all_checks_passed = all(pass_dict.values())
    overall_pass = all_checks_passed and (quality_score >= config.min_quality_score)

    if all_checks_passed and not overall_pass:
        all_failed_reasons.append("low_quality")

    # Primary failure reason code
    primary_reason: Optional[str] = all_failed_reasons[0] if all_failed_reasons else None
    human_reason: Optional[str] = (
        _HUMAN_MESSAGES.get(primary_reason, "Image quality insufficient. Please retake.")
        if primary_reason
        else "Image quality acceptable"
    )

    # ── Post-Processing (ONLY for quality PASS images) ───────────────────────
    ai_ready_image_b64: Optional[str] = None

    if overall_pass:
        # Step 1: Crop to detected mucosa ROI (with padding)
        cropped_bgr = crop_to_oral_region(image_bgr, shared, config)

        # Step 2: Resize to Member C's target input size (e.g. 224x224)
        resized_bgr = resize_image(cropped_bgr, config.model_input_size)

        # Step 3: Enhance image (CLAHE on LAB L-channel + bilateral filter)
        enhanced_bgr = enhance_image(resized_bgr, config)

        # Step 4: Encode to Base64 JPEG for transport to Member C
        ai_ready_image_b64 = encode_to_base64(enhanced_bgr)

    timestamp_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return {
        "passed":             overall_pass,
        "pass":               overall_pass,  # legacy alias for Member D backend
        "quality_score":      quality_score,
        "reason":             primary_reason,
        "human_reason":       human_reason,
        "all_failed_reasons": all_failed_reasons,
        "checks":             checks,
        "scores":             scores,
        "ai_ready_image":     ai_ready_image_b64,
        "preprocessed_image_b64": ai_ready_image_b64, # alias for Member C / legacy clients
        "timestamp":          timestamp_iso,
        "module_version":     MODULE_VERSION,
    }


def run_quality_pipeline(
    image_input: ImageInputType, config: Optional[QualityConfig] = None
) -> Dict[str, Any]:
    """Alias for check_image_quality to match Member B stable pipeline specification."""
    return check_image_quality(image_input, config=config)
