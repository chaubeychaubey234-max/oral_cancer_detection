"""
Quality Check Configuration and Threshold Definitions.
All thresholds are defined as named constants and exposed via a configurable data structure
to avoid hardcoded inline values and allow easy tuning per deployment environment.
"""

from dataclasses import dataclass
from typing import Tuple

# Default quality check thresholds
DEFAULT_BLUR_THRESHOLD: float = 100.0          # Min Laplacian variance score (below = blurry)
DEFAULT_BRIGHTNESS_MIN: float = 40.0            # Min average luminance 0-255 (below = underexposed)
DEFAULT_BRIGHTNESS_MAX: float = 215.0           # Max average luminance 0-255 (above = overexposed)
DEFAULT_MAX_GLARE_AREA_PCT: float = 5.0         # Max specular highlight % of total image area
DEFAULT_MIN_FRAMING_CONFIDENCE: float = 0.50     # Min oral mucosa presence confidence score (0.0 to 1.0)

# Color bounds for human oral mucosa tissue in YCrCb color space
# Inner oral mucosa (buccal, labial, gingiva) exhibits high Cr (135-190) and lower Cb (65-125)
MUCOSA_YCRCB_MIN: Tuple[int, int, int] = (30, 135, 65)
MUCOSA_YCRCB_MAX: Tuple[int, int, int] = (245, 190, 125)

# Outer skin boundary (used to differentiate facial skin from inner oral cavity)
SKIN_CB_MIN: int = 112

# Specular glare highlight detection bounds in HSV color space
# Flash reflections on moist mucosa produce extremely high Value (V) combined with low Saturation (S)
GLARE_SATURATION_MAX: int = 45
GLARE_VALUE_MIN: int = 230


@dataclass
class QualityConfig:
    """
    Configurable parameters for the TobaccoShield image quality inspection engine.
    
    Attributes:
        blur_threshold (float): Minimum Laplacian variance threshold. Lower means more blur allowed.
        brightness_min (float): Minimum mean luminance value (0-255). Below this is marked 'underexposed'.
        brightness_max (float): Maximum mean luminance value (0-255). Above this is marked 'overexposed'.
        max_glare_area_pct (float): Maximum allowed percentage of pixels affected by specular glare.
        min_framing_confidence (float): Minimum required framing/mucosa presence score (0.0 - 1.0).
    """
    blur_threshold: float = DEFAULT_BLUR_THRESHOLD
    brightness_min: float = DEFAULT_BRIGHTNESS_MIN
    brightness_max: float = DEFAULT_BRIGHTNESS_MAX
    max_glare_area_pct: float = DEFAULT_MAX_GLARE_AREA_PCT
    min_framing_confidence: float = DEFAULT_MIN_FRAMING_CONFIDENCE
