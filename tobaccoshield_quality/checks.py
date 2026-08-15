"""
OpenCV Image Quality Check Implementations.
Each function performs a standalone computer vision check using standard OpenCV/NumPy
operations for maximum execution speed (<30ms per frame) and exportability to C++/TFLite/on-device engines.
"""

from typing import Tuple
import cv2
import numpy as np

from .config import (
    GLARE_SATURATION_MAX,
    GLARE_VALUE_MIN,
    MUCOSA_YCRCB_MAX,
    MUCOSA_YCRCB_MIN,
)


def check_blur(image_bgr: np.ndarray, threshold: float = 100.0) -> Tuple[float, bool]:
    """
    Evaluates image sharpness using the variance of the Laplacian operator.

    High Laplacian variance indicates sharp edges and fine details.
    Low variance indicates blur (out of focus or motion blur).

    Args:
        image_bgr (np.ndarray): Input BGR image matrix.
        threshold (float): Minimum variance cutoff for a sharp photo.

    Returns:
        Tuple[float, bool]: (blur_score, is_pass)
            - blur_score: Calculated Laplacian variance (float).
            - is_pass: True if blur_score >= threshold, False otherwise.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    blur_score = float(round(laplacian_var, 2))
    is_pass = blur_score >= threshold
    return blur_score, is_pass


def check_exposure(
    image_bgr: np.ndarray, min_brightness: float = 40.0, max_brightness: float = 215.0
) -> Tuple[float, str, bool]:
    """
    Evaluates exposure / lighting conditions using mean luminance intensity.

    Args:
        image_bgr (np.ndarray): Input BGR image matrix.
        min_brightness (float): Lower brightness boundary (0-255). Below this is 'underexposed'.
        max_brightness (float): Upper brightness boundary (0-255). Above this is 'overexposed'.

    Returns:
        Tuple[float, str, bool]: (brightness_score, verdict, is_pass)
            - brightness_score: Average grayscale intensity (0.0 to 255.0).
            - verdict: 'underexposed' | 'overexposed' | 'ok'
            - is_pass: True if within [min_brightness, max_brightness], False otherwise.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    brightness_score = float(round(np.mean(gray), 2))

    if brightness_score < min_brightness:
        return brightness_score, "underexposed", False
    elif brightness_score > max_brightness:
        return brightness_score, "overexposed", False
    else:
        return brightness_score, "ok", True


def check_glare(
    image_bgr: np.ndarray, max_glare_pct: float = 5.0
) -> Tuple[float, bool]:
    """
    Detects specular reflections / flash highlights on moist oral mucosal surfaces.

    Specular highlights on wet mucosa produce high Value (brightness) and low Saturation
    in HSV color space.

    Args:
        image_bgr (np.ndarray): Input BGR image matrix.
        max_glare_pct (float): Maximum allowed percentage of total image area covered by glare.

    Returns:
        Tuple[float, bool]: (glare_area_pct, is_pass)
            - glare_area_pct: Percentage of pixels identified as glare (0.0 to 100.0).
            - is_pass: True if glare_area_pct <= max_glare_pct, False otherwise.
    """
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    
    # Glare mask: low saturation (S <= 45) AND high value (V >= 230)
    s_channel = hsv[:, :, 1]
    v_channel = hsv[:, :, 2]
    
    glare_mask = (s_channel <= GLARE_SATURATION_MAX) & (v_channel >= GLARE_VALUE_MIN)
    glare_pixel_count = np.count_nonzero(glare_mask)
    total_pixels = image_bgr.shape[0] * image_bgr.shape[1]

    glare_area_pct = float(round((glare_pixel_count / total_pixels) * 100.0, 2))
    is_pass = glare_area_pct <= max_glare_pct
    return glare_area_pct, is_pass


def check_framing(
    image_bgr: np.ndarray, min_confidence: float = 0.50
) -> Tuple[float, bool]:
    """
    Rule-based framing heuristic to confirm buccal/oral mucosa is plausibly in frame.

    Analyzes:
    1. YCrCb mucosal chrominance coverage (pinkish/reddish mucosal color bounds).
    2. Central Region of Interest (ROI) tissue concentration vs borders.
    3. Structural texture / edge distribution on tissue regions.

    Args:
        image_bgr (np.ndarray): Input BGR image matrix.
        min_confidence (float): Minimum confidence threshold (0.0 to 1.0).

    Returns:
        Tuple[float, bool]: (framing_confidence, is_pass)
            - framing_confidence: Probability score that oral mucosa is centered in frame (0.0 to 1.0).
            - is_pass: True if framing_confidence >= min_confidence, False otherwise.
    """
    h, w = image_bgr.shape[:2]
    total_pixels = h * w

    # 1. Convert to YCrCb space for mucosal chromaticity analysis
    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    cr_channel = ycrcb[:, :, 1]
    cb_channel = ycrcb[:, :, 2]

    # Binary mask for mucosal tissue color range
    tissue_mask = (
        (cr_channel >= MUCOSA_YCRCB_MIN[1]) & (cr_channel <= MUCOSA_YCRCB_MAX[1]) &
        (cb_channel >= MUCOSA_YCRCB_MIN[2]) & (cb_channel <= MUCOSA_YCRCB_MAX[2])
    )
    overall_tissue_ratio = np.count_nonzero(tissue_mask) / total_pixels

    # 2. Central Region of Interest (ROI) analysis (middle 60% of width and height)
    y1, y2 = int(h * 0.2), int(h * 0.8)
    x1, x2 = int(w * 0.2), int(w * 0.8)
    center_roi = tissue_mask[y1:y2, x1:x2]
    center_tissue_ratio = np.count_nonzero(center_roi) / center_roi.size if center_roi.size > 0 else 0.0

    # 3. Structural texture check (avoid plain flat pink backgrounds)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.count_nonzero(edges) / total_pixels

    # Scoring heuristic:
    # - Central tissue presence has highest weight (0.60)
    # - Overall tissue presence weight (0.25)
    # - Edge texture component weight (0.15)
    center_score = min(1.0, center_tissue_ratio / 0.35)  # expects >=35% mucosal tissue in center
    overall_score = min(1.0, overall_tissue_ratio / 0.25) # expects >=25% overall tissue
    texture_score = min(1.0, edge_density / 0.02)         # expects realistic tissue edge structure

    raw_confidence = (0.60 * center_score) + (0.25 * overall_score) + (0.15 * texture_score)
    framing_confidence = float(round(np.clip(raw_confidence, 0.0, 1.0), 2))
    is_pass = framing_confidence >= min_confidence

    return framing_confidence, is_pass
