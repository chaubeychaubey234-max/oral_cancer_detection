"""
OpenCV Image Quality Check Implementations — Member B.

Seven standalone checks, each returning a numeric score and a pass/fail boolean.
All operations use OpenCV + NumPy only — no external APIs, no cloud, no heavy models.
Designed for eventual on-device execution on low-end Android/iOS hardware.

SHARED FEATURE COMPUTATION
--------------------------
Call build_shared_features(image_bgr) ONCE per image and pass the returned dict to
checks 1-4 (positioning, framing, buccal mucosa, distance).
This avoids recomputing the mucosa mask, skin mask, edge density, bounding box,
and centroid redundantly across four checks that all need the same YCrCb conversion.
Checks 5-7 (blur, lighting, glare) operate independently.
"""

from typing import Dict, Optional, Tuple
import cv2
import numpy as np

from .config import (
    GLARE_SATURATION_MAX,
    GLARE_VALUE_MIN,
    MUCOSA_YCRCB_MAX,
    MUCOSA_YCRCB_MIN,
)


# ─────────────────────────────────────────────────────────────────────────────
# Shared Feature Computation  (call ONCE per image, reuse across checks 1–4)
# ─────────────────────────────────────────────────────────────────────────────

def build_shared_features(image_bgr: np.ndarray) -> Dict:
    """
    Computes per-image features that are shared across multiple quality checks.

    Performs the YCrCb colour-space conversion and mucosa/skin/teeth/shadow mask
    computation only once. The result is a plain dict (zero-copy reference to masks)
    that is passed to any check that needs it.

    Returns:
        dict:
            mucosa_mask      (np.ndarray bool) — inner buccal mucosa pixels
            skin_mask        (np.ndarray bool) — outer facial skin pixels
            teeth_mask       (np.ndarray bool) — bright dental structures
            shadow_mask      (np.ndarray bool) — dark shadow voids (Y < 35)
            overall_ratio    (float)           — mucosa pixels / total pixels
            centroid_x_norm  (float)           — mucosa centroid, 0=left  1=right
            centroid_y_norm  (float)           — mucosa centroid, 0=top   1=bottom
            bbox             (tuple|None)      — (x1, y1, x2, y2) pixel bbox of mucosa
            edge_density     (float)           — Canny edges inside mucosa / mucosa pixels
    """
    h, w = image_bgr.shape[:2]
    total_pixels = h * w

    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    y_ch  = ycrcb[:, :, 0]
    cr_ch = ycrcb[:, :, 1]
    cb_ch = ycrcb[:, :, 2]

    # Inner buccal mucosa — warm red-pink hue: high Cr, lower Cb
    mucosa_mask = (
        (cr_ch >= 150) & (cr_ch <= MUCOSA_YCRCB_MAX[1]) &
        (cb_ch >= 65)  & (cb_ch <= 118) &
        (y_ch  >= 35)  & (y_ch  <= 245)
    )

    # Outer facial skin — lower Cr or higher Cb, mid-range luminance
    skin_mask = (
        ((cr_ch < 150) | (cb_ch > 118)) &
        (y_ch >= 70) & (y_ch <= 235)
    )

    # Bright dental structures — very high luminance, near-neutral chrominance
    teeth_mask = (
        (y_ch >= 195) &
        (np.abs(cr_ch.astype(np.int16) - 128) <= 16) &
        (np.abs(cb_ch.astype(np.int16) - 128) <= 16)
    )

    # Dark shadow / background voids
    shadow_mask = (y_ch < 35)

    mucosa_pixels = int(np.count_nonzero(mucosa_mask))
    overall_ratio = mucosa_pixels / total_pixels

    # Mucosa centroid (normalised 0–1) and bounding box
    cx_norm, cy_norm = 0.5, 0.5
    bbox: Optional[Tuple[int, int, int, int]] = None
    if mucosa_pixels > 0:
        coords = np.argwhere(mucosa_mask)       # shape (N, 2): [row, col]
        cy_norm = float(coords[:, 0].mean() / h)
        cx_norm = float(coords[:, 1].mean() / w)
        r0, c0 = int(coords[:, 0].min()), int(coords[:, 1].min())
        r1, c1 = int(coords[:, 0].max()), int(coords[:, 1].max())
        bbox = (c0, r0, c1, r1)                # (x1, y1, x2, y2)

    # Texture / edge density inside the mucosa region
    gray  = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 40, 120)
    mucosa_edges = edges & mucosa_mask
    edge_density = (
        float(np.count_nonzero(mucosa_edges) / mucosa_pixels)
        if mucosa_pixels > 0 else 0.0
    )

    return {
        "mucosa_mask":     mucosa_mask,
        "skin_mask":       skin_mask,
        "teeth_mask":      teeth_mask,
        "shadow_mask":     shadow_mask,
        "overall_ratio":   float(overall_ratio),
        "centroid_x_norm": float(cx_norm),
        "centroid_y_norm": float(cy_norm),
        "bbox":            bbox,
        "edge_density":    float(edge_density),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Check 1 — Positioning
# ─────────────────────────────────────────────────────────────────────────────

def check_positioning(
    image_bgr: np.ndarray,
    shared: Optional[Dict] = None,
    min_score: float = 0.45,
) -> Tuple[float, bool]:
    """
    Verifies the oral region is approximately centred and not at the frame edge.

    Scoring components:
    - centring_score: distance of mucosa centroid from frame centre (1.0 = perfect centre)
    - presence_score: whether there is enough mucosa to evaluate position at all

    Returns:
        Tuple[float, bool]: (positioning_score 0–1, is_pass)
    """
    if shared is None:
        shared = build_shared_features(image_bgr)

    cx = shared["centroid_x_norm"]
    cy = shared["centroid_y_norm"]
    overall_ratio = shared["overall_ratio"]

    # Euclidean distance of centroid from the frame centre (0,0 to 0.707 max)
    dx = abs(cx - 0.5)
    dy = abs(cy - 0.5)
    dist = (dx ** 2 + dy ** 2) ** 0.5
    # Scale so that 0.35 units off-centre → score 0 (generous band around centre)
    centring_score = float(max(0.0, 1.0 - dist / 0.35))

    # Presence gate: barely-visible mucosa cannot be well-positioned
    presence_score = min(1.0, overall_ratio / 0.10)

    raw = 0.65 * centring_score + 0.35 * presence_score
    positioning_score = float(round(float(np.clip(raw, 0.0, 1.0)), 4))
    return positioning_score, positioning_score >= min_score


# ─────────────────────────────────────────────────────────────────────────────
# Check 2 — Framing
# ─────────────────────────────────────────────────────────────────────────────

def check_framing(
    image_bgr: np.ndarray,
    shared: Optional[Dict] = None,
    min_confidence: float = 0.50,
) -> Tuple[float, bool]:
    """
    Discriminative rule-based framing check for inner buccal mucosa positioning.

    Uses shared features (mucosa/skin/teeth/shadow masks) if provided.
    Falls back to computing its own features if shared is None (backward compat).

    Evaluates:
    1. YCrCb mucosal chrominance in the central 60% ROI.
    2. Facial skin penalty — outer skin dominating frame.
    3. Teeth penalty — dental structures dominating frame.
    4. Shadow penalty — dark background voids in centre.
    5. Texture/edge density — realistic mucosal surface texture.

    Returns:
        Tuple[float, bool]: (framing_confidence 0–1, is_pass)
    """
    h, w = image_bgr.shape[:2]
    total_pixels = h * w

    if shared is None:
        shared = build_shared_features(image_bgr)

    mucosa_mask = shared["mucosa_mask"]
    skin_mask   = shared["skin_mask"]
    teeth_mask  = shared["teeth_mask"]
    shadow_mask = shared["shadow_mask"]

    # Central 60% ROI
    y1, y2 = int(h * 0.2), int(h * 0.8)
    x1, x2 = int(w * 0.2), int(w * 0.8)

    center_mucosa = mucosa_mask[y1:y2, x1:x2]
    center_skin   = skin_mask[y1:y2, x1:x2]
    center_teeth  = teeth_mask[y1:y2, x1:x2]
    center_shadow = shadow_mask[y1:y2, x1:x2]
    center_total  = max(center_mucosa.size, 1)

    center_mucosa_ratio  = np.count_nonzero(center_mucosa)  / center_total
    overall_mucosa_ratio = shared["overall_ratio"]
    center_skin_ratio    = np.count_nonzero(center_skin)   / center_total
    center_teeth_ratio   = np.count_nonzero(center_teeth)  / center_total
    center_shadow_ratio  = np.count_nonzero(center_shadow) / center_total

    center_score  = min(1.0, center_mucosa_ratio  / 0.35)
    overall_score = min(1.0, overall_mucosa_ratio / 0.25)
    texture_score = min(1.0, shared["edge_density"] / 0.03)

    skin_penalty   = min(0.50, center_skin_ratio   * 0.85)
    teeth_penalty  = min(0.40, center_teeth_ratio  * 0.85)
    shadow_penalty = min(0.40, center_shadow_ratio * 0.85)

    raw = (
        (0.50 * center_score) +
        (0.30 * overall_score) +
        (0.20 * texture_score) -
        skin_penalty - teeth_penalty - shadow_penalty
    )

    framing_confidence = float(round(float(np.clip(raw, 0.0, 1.0)), 4))
    return framing_confidence, framing_confidence >= min_confidence


# ─────────────────────────────────────────────────────────────────────────────
# Check 3 — Buccal Mucosa Detection
# ─────────────────────────────────────────────────────────────────────────────

def check_buccal_mucosa(
    image_bgr: np.ndarray,
    shared: Optional[Dict] = None,
    min_ratio: float = 0.15,
) -> Tuple[float, bool]:
    """
    Dedicated check: is a sufficient amount of inner buccal mucosa tissue visible?

    This is an independent quality gate — NOT disease detection.
    Uses YCrCb chrominance to identify mucosa tissue (lightweight, no external model).
    Separate from framing so the pipeline can report specifically why it failed.

    Returns:
        Tuple[float, bool]: (mucosa_ratio 0–1, is_pass)
            mucosa_ratio — fraction of total image pixels classified as mucosa tissue.
    """
    if shared is None:
        shared = build_shared_features(image_bgr)

    mucosa_ratio = shared["overall_ratio"]
    return float(round(mucosa_ratio, 4)), mucosa_ratio >= min_ratio


# ─────────────────────────────────────────────────────────────────────────────
# Check 4 — Distance / Coverage
# ─────────────────────────────────────────────────────────────────────────────

def check_distance(
    image_bgr: np.ndarray,
    shared: Optional[Dict] = None,
    min_coverage: float = 0.12,
    max_coverage: float = 0.92,
) -> Tuple[float, str, bool]:
    """
    Determines whether the camera is too close, too far, or at an appropriate distance.

    Uses the overall mucosa coverage ratio as a proxy for camera distance:
    - Too little coverage → camera too far away, important tissue is not captured.
    - Near full-frame coverage → camera too close, edges of the tissue are cropped.

    Returns:
        Tuple[float, str, bool]: (coverage_ratio, distance_verdict, is_pass)
            distance_verdict: 'ok' | 'too_far' | 'too_close'
    """
    if shared is None:
        shared = build_shared_features(image_bgr)

    ratio = shared["overall_ratio"]

    if ratio < min_coverage:
        return float(round(ratio, 4)), "too_far", False
    elif ratio > max_coverage:
        return float(round(ratio, 4)), "too_close", False
    else:
        return float(round(ratio, 4)), "ok", True


# ─────────────────────────────────────────────────────────────────────────────
# Check 5 — Blur Detection
# ─────────────────────────────────────────────────────────────────────────────

def check_blur(image_bgr: np.ndarray, threshold: float = 100.0) -> Tuple[float, bool]:
    """
    Evaluates image sharpness using the variance of the Laplacian operator.

    High Laplacian variance → sharp edges and fine tissue detail.
    Low variance → blur (out of focus or motion blur during capture).

    Efficient single-pass operation suitable for low-end devices.
    No disease labels are used or implied.

    Args:
        image_bgr (np.ndarray): Input BGR image matrix.
        threshold (float): Minimum variance score for a usable image.

    Returns:
        Tuple[float, bool]: (blur_score, is_pass)
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    blur_score = float(round(laplacian_var, 2))
    return blur_score, blur_score >= threshold


# ─────────────────────────────────────────────────────────────────────────────
# Check 6 — Lighting / Exposure
# ─────────────────────────────────────────────────────────────────────────────

def check_lighting(
    image_bgr: np.ndarray,
    shared: Optional[Dict] = None,
    min_brightness: float = 40.0,
    max_brightness: float = 215.0,
    max_unevenness: float = 80.0,
) -> Tuple[float, float, str, bool]:
    """
    Evaluates lighting conditions: overall brightness AND spatial unevenness.

    Evaluates the detected mucosa bounding-box ROI where available so the check
    reflects the actual oral tissue illumination, not background dark areas.
    Falls back to the central 60% frame if no mucosa bbox is available.

    Checks three failure modes:
    - underexposed:    mean brightness < min_brightness
    - overexposed:     mean brightness > max_brightness
    - uneven_lighting: luminance std-dev > max_unevenness (harsh shadows / flash)

    Returns:
        Tuple[float, float, str, bool]:
            (brightness_score, unevenness_score, lighting_verdict, is_pass)
            lighting_verdict: 'ok' | 'underexposed' | 'overexposed' | 'uneven_lighting'
    """
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Evaluate within oral ROI where possible
    if shared is not None and shared.get("bbox") is not None:
        x1, y1, x2, y2 = shared["bbox"]
        roi = gray[y1:y2, x1:x2] if (y2 > y1 and x2 > x1) else gray
    else:
        ry1, ry2 = int(h * 0.2), int(h * 0.8)
        rx1, rx2 = int(w * 0.2), int(w * 0.8)
        roi = gray[ry1:ry2, rx1:rx2]

    brightness = float(round(float(np.mean(roi)), 2))
    unevenness = float(round(float(np.std(roi)), 2))

    if brightness < min_brightness:
        return brightness, unevenness, "underexposed", False
    elif brightness > max_brightness:
        return brightness, unevenness, "overexposed", False
    elif unevenness > max_unevenness:
        return brightness, unevenness, "uneven_lighting", False
    else:
        return brightness, unevenness, "ok", True


def check_exposure(
    image_bgr: np.ndarray,
    min_brightness: float = 40.0,
    max_brightness: float = 215.0,
) -> Tuple[float, str, bool]:
    """
    Backward-compatibility alias for check_lighting (brightness-only mode).

    Used by core.py's legacy output to populate scores["brightness_score"] and
    the Member D contract key "reason" values "underexposed" / "overexposed".
    """
    brightness, _, verdict, is_pass = check_lighting(
        image_bgr,
        shared=None,
        min_brightness=min_brightness,
        max_brightness=max_brightness,
        max_unevenness=9999.0,   # disable unevenness in backward-compat mode
    )
    return brightness, verdict, is_pass


# ─────────────────────────────────────────────────────────────────────────────
# Check 7 — Glare / Reflection Detection
# ─────────────────────────────────────────────────────────────────────────────

def check_glare(
    image_bgr: np.ndarray, max_glare_pct: float = 5.0
) -> Tuple[float, bool]:
    """
    Detects specular reflections / glare that obscure the oral mucosal region.

    Uses HSV colour space: specular highlights from flash or saliva produce
    very high Value (V ≥ 230) combined with very low Saturation (S ≤ 45).
    Normal bright teeth have higher saturation and are not flagged by this check.

    Only rejects glare that covers enough of the frame to obscure clinically
    relevant oral tissue (threshold configurable via max_glare_pct).

    Returns:
        Tuple[float, bool]: (glare_area_pct 0–100, is_pass)
    """
    hsv  = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    s_ch = hsv[:, :, 1]
    v_ch = hsv[:, :, 2]

    glare_mask  = (s_ch <= GLARE_SATURATION_MAX) & (v_ch >= GLARE_VALUE_MIN)
    glare_count = int(np.count_nonzero(glare_mask))
    total       = image_bgr.shape[0] * image_bgr.shape[1]

    glare_pct = float(round((glare_count / total) * 100.0, 2))
    return glare_pct, glare_pct <= max_glare_pct
