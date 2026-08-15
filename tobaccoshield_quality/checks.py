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
    
    # Glare mask: low saturation (S <= GLARE_SATURATION_MAX) AND high value (V >= GLARE_VALUE_MIN)
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
    Discriminative rule-based framing check to verify inner buccal mucosa positioning.

    Evaluates:
    1. YCrCb mucosal chrominance (distinguishes inner mucosa from outer facial skin/background).
    2. Central ROI concentration (verifies mucosa is centered, not just peripheral).
    3. Facial skin penalty (detects dominance of outer face/lip skin vs. inner oral cavity).
    4. Teeth occlusion penalty (detects dominance of dental structures vs. mucosal tissue).
    5. Shadow/darkness gap penalty (detects out-of-focus background dark voids).

    Args:
        image_bgr (np.ndarray): Input BGR image matrix.
        min_confidence (float): Minimum confidence threshold (0.0 to 1.0).

    Returns:
        Tuple[float, bool]: (framing_confidence, is_pass)
            - framing_confidence: Calculated confidence score (0.0 to 1.0).
            - is_pass: True if framing_confidence >= min_confidence, False otherwise.
    """
    h, w = image_bgr.shape[:2]
    total_pixels = h * w

    # 1. Color Space Conversions
    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    y_channel = ycrcb[:, :, 0]
    cr_channel = ycrcb[:, :, 1]
    cb_channel = ycrcb[:, :, 2]

    # Inner Buccal Mucosa Chromaticity Mask (Deep red-pinkish hue: Cr >= 150, Cb <= 118)
    mucosa_mask = (
        (cr_channel >= 150) & (cr_channel <= MUCOSA_YCRCB_MAX[1]) &
        (cb_channel >= 65) & (cb_channel <= 118) &
        (y_channel >= 35) & (y_channel <= 245)
    )

    # Outer Facial Skin Mask (Lower Cr < 150 or higher Cb > 118)
    skin_mask = (
        ((cr_channel < 150) | (cb_channel > 118)) &
        (y_channel >= 70) & (y_channel <= 235)
    )

    # Teeth / Bright Dental Restoration Mask (High luminance, low chrominance variation)
    teeth_mask = (
        (y_channel >= 195) &
        (np.abs(cr_channel.astype(np.int16) - 128) <= 16) &
        (np.abs(cb_channel.astype(np.int16) - 128) <= 16)
    )

    # Dark Shadow / Void Mask (Low luminance Y < 35)
    shadow_mask = (y_channel < 35)

    # 2. Central Region of Interest (ROI) - Middle 60% of frame
    y1, y2 = int(h * 0.2), int(h * 0.8)
    x1, x2 = int(w * 0.2), int(w * 0.8)
    
    center_mucosa = mucosa_mask[y1:y2, x1:x2]
    center_skin = skin_mask[y1:y2, x1:x2]
    center_teeth = teeth_mask[y1:y2, x1:x2]
    center_shadow = shadow_mask[y1:y2, x1:x2]

    center_total = center_mucosa.size if center_mucosa.size > 0 else 1

    center_mucosa_ratio = np.count_nonzero(center_mucosa) / center_total
    overall_mucosa_ratio = np.count_nonzero(mucosa_mask) / total_pixels

    center_skin_ratio = np.count_nonzero(center_skin) / center_total
    center_teeth_ratio = np.count_nonzero(center_teeth) / center_total
    center_shadow_ratio = np.count_nonzero(center_shadow) / center_total

    # 3. Texture / Edge Density Check on Mucosal Regions
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 40, 120)
    mucosa_edges = edges & mucosa_mask
    mucosa_pixel_count = np.count_nonzero(mucosa_mask)
    edge_density = (np.count_nonzero(mucosa_edges) / mucosa_pixel_count) if mucosa_pixel_count > 0 else 0.0

    # 4. Confidence Scoring Math
    center_score = min(1.0, center_mucosa_ratio / 0.35)     # expects >=35% center mucosa
    overall_score = min(1.0, overall_mucosa_ratio / 0.25)    # expects >=25% overall mucosa
    texture_score = min(1.0, edge_density / 0.03)            # expects realistic texture

    # Penalties for non-mucosa edge cases
    skin_penalty = min(0.50, center_skin_ratio * 0.85)       # penalize facial skin dominating frame
    teeth_penalty = min(0.40, center_teeth_ratio * 0.85)     # penalize dominant teeth
    shadow_penalty = min(0.40, center_shadow_ratio * 0.85)   # penalize dark background shadows

    raw_confidence = (
        (0.50 * center_score) +
        (0.30 * overall_score) +
        (0.20 * texture_score) -
        skin_penalty -
        teeth_penalty -
        shadow_penalty
    )

    framing_confidence = float(round(np.clip(raw_confidence, 0.0, 1.0), 2))
    is_pass = framing_confidence >= min_confidence

    return framing_confidence, is_pass
