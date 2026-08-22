"""
Quality Check Configuration and Threshold Definitions.

ALL thresholds live here — never scatter magic numbers through the codebase.
Tune these against real captured images before field deployment.
Pass a custom QualityConfig instance to check_image_quality() to override any value.
"""

from dataclasses import dataclass
from typing import Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Quality Check Thresholds
# ─────────────────────────────────────────────────────────────────────────────

# Blur — Laplacian variance; real phone photos of sharp mucosa typically 200–1500+
DEFAULT_BLUR_THRESHOLD: float = 100.0

# Lighting / Exposure
DEFAULT_BRIGHTNESS_MIN: float = 40.0           # below = underexposed (0–255 scale)
DEFAULT_BRIGHTNESS_MAX: float = 215.0          # above = overexposed
DEFAULT_LIGHTING_UNEVENNESS_MAX: float = 80.0  # std-dev of luminance in oral ROI

# Glare — specular reflection as % of total image pixels
DEFAULT_MAX_GLARE_AREA_PCT: float = 5.0

# Framing — composite confidence score (0–1)
DEFAULT_MIN_FRAMING_CONFIDENCE: float = 0.50

# Positioning — how well the oral centroid is centred in the frame (0–1)
DEFAULT_MIN_POSITIONING_SCORE: float = 0.45

# Buccal Mucosa Detection — min fraction of frame that must be mucosa tissue
DEFAULT_MIN_BUCCAL_MUCOSA_RATIO: float = 0.15

# Distance / Coverage — mucosa coverage ratio as a camera-distance proxy
DEFAULT_MIN_COVERAGE_RATIO: float = 0.12   # below → camera too far
DEFAULT_MAX_COVERAGE_RATIO: float = 1.00   # above → max allowable coverage (1.0 = full frame)

# Overall quality gate — weighted score must exceed this to issue PASS
DEFAULT_MIN_QUALITY_SCORE: float = 0.55

# ─────────────────────────────────────────────────────────────────────────────
# Color Space Constants — oral mucosa tissue ranges
# ─────────────────────────────────────────────────────────────────────────────

# Inner oral mucosa (buccal, labial, gingiva) in YCrCb:
# high Cr (135–190) indicates warm red-pink hue; lower Cb (65–125)
MUCOSA_YCRCB_MIN: Tuple[int, int, int] = (30, 135, 65)
MUCOSA_YCRCB_MAX: Tuple[int, int, int] = (245, 190, 125)

# Outer skin boundary (differentiates facial skin from inner oral cavity)
SKIN_CB_MIN: int = 112

# Specular glare in HSV: very high V + very low S
GLARE_SATURATION_MAX: int = 45
GLARE_VALUE_MIN: int = 230

# ─────────────────────────────────────────────────────────────────────────────
# Quality Score Weights  (must sum to 1.0)
# Blur and framing are weighted highest as they most strongly affect model accuracy.
# ─────────────────────────────────────────────────────────────────────────────

QUALITY_SCORE_WEIGHTS: dict = {
    "positioning":       0.10,
    "framing":           0.15,
    "buccal_mucosa":     0.15,
    "distance_coverage": 0.10,
    "blur":              0.25,
    "lighting":          0.15,
    "glare":             0.10,
}  # Sum = 1.00

# ─────────────────────────────────────────────────────────────────────────────
# Post-processing Defaults
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_MODEL_INPUT_SIZE: Tuple[int, int] = (224, 224)  # (width, height) — Member C's model input
DEFAULT_CROP_PADDING_PCT: float = 0.08                  # padding % around detected mucosa bbox
DEFAULT_APPLY_ENHANCEMENT: bool = True                  # CLAHE + bilateral filter toggle
DEFAULT_CLAHE_CLIP_LIMIT: float = 2.0
DEFAULT_CLAHE_TILE_SIZE: Tuple[int, int] = (8, 8)
DEFAULT_BILATERAL_D: int = 5           # kernel diameter — d=5 is fastest with useful denoising
DEFAULT_BILATERAL_SIGMA_COLOR: int = 35
DEFAULT_BILATERAL_SIGMA_SPACE: int = 35


@dataclass
class QualityConfig:
    """
    Single configuration object for the complete Member B pipeline.

    Pass a custom instance to check_image_quality() to override any threshold
    without touching source code — essential for calibration with real device images.

    Attributes (quality checks):
        blur_threshold            Minimum Laplacian variance (below = blurry).
        brightness_min            Minimum mean luminance 0-255 (below = underexposed).
        brightness_max            Maximum mean luminance 0-255 (above = overexposed).
        lighting_unevenness_max   Max luminance std-dev in oral ROI (above = uneven).
        max_glare_area_pct        Max % of pixels classified as specular glare.
        min_framing_confidence    Min composite framing confidence score (0-1).
        min_positioning_score     Min oral-centroid centring score (0-1).
        min_buccal_mucosa_ratio   Min fraction of frame that must show mucosa tissue.
        min_coverage_ratio        Too-far threshold: mucosa coverage < this → fail.
        max_coverage_ratio        Too-close threshold: mucosa coverage > this → fail.
        min_quality_score         Minimum overall weighted quality score to issue PASS.

    Attributes (post-processing):
        model_input_size          (width, height) resize target for Member C's model.
        crop_padding_pct          Padding fraction around the detected mucosa bbox.
        apply_enhancement         Toggle CLAHE + bilateral filter on/off.
        clahe_clip_limit          CLAHE clip limit (higher = more contrast boost).
        clahe_tile_size           CLAHE tile grid size.
        bilateral_d               Bilateral filter neighbourhood diameter.
        bilateral_sigma_color     Bilateral colour tolerance.
        bilateral_sigma_space     Bilateral spatial tolerance.
    """
    # Quality check thresholds
    blur_threshold: float = DEFAULT_BLUR_THRESHOLD
    brightness_min: float = DEFAULT_BRIGHTNESS_MIN
    brightness_max: float = DEFAULT_BRIGHTNESS_MAX
    lighting_unevenness_max: float = DEFAULT_LIGHTING_UNEVENNESS_MAX
    max_glare_area_pct: float = DEFAULT_MAX_GLARE_AREA_PCT
    min_framing_confidence: float = DEFAULT_MIN_FRAMING_CONFIDENCE
    min_positioning_score: float = DEFAULT_MIN_POSITIONING_SCORE
    min_buccal_mucosa_ratio: float = DEFAULT_MIN_BUCCAL_MUCOSA_RATIO
    min_coverage_ratio: float = DEFAULT_MIN_COVERAGE_RATIO
    max_coverage_ratio: float = DEFAULT_MAX_COVERAGE_RATIO
    min_quality_score: float = DEFAULT_MIN_QUALITY_SCORE

    # Post-processing settings
    model_input_size: Tuple[int, int] = DEFAULT_MODEL_INPUT_SIZE
    crop_padding_pct: float = DEFAULT_CROP_PADDING_PCT
    apply_enhancement: bool = DEFAULT_APPLY_ENHANCEMENT
    clahe_clip_limit: float = DEFAULT_CLAHE_CLIP_LIMIT
    clahe_tile_size: Tuple[int, int] = DEFAULT_CLAHE_TILE_SIZE
    bilateral_d: int = DEFAULT_BILATERAL_D
    bilateral_sigma_color: int = DEFAULT_BILATERAL_SIGMA_COLOR
    bilateral_sigma_space: int = DEFAULT_BILATERAL_SIGMA_SPACE
