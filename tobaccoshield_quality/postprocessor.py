"""
Post-Processing Pipeline for Quality-Verified Oral Mucosa Images — Member B.

Applied ONLY to images that pass all 7 quality checks.
Produces a clean, preprocessed, AI-ready image for Member C's risk model.

Pipeline (in order):
    1. crop_to_oral_region  — crop to detected mucosa bbox + configurable padding
    2. resize_image         — scale to Member C's model input size (configurable)
    3. enhance_image        — CLAHE + bilateral filter (optional, configurable)
    4. normalize_image      — scale pixels to [0.0, 1.0] float32
    5. encode_to_base64     — JPEG → base64 string for HTTP/JSON transport

Design constraints:
    - No external APIs or cloud services
    - All parameters configurable via QualityConfig — never hard-code model sizes
    - Do NOT alter lesion colour, texture, or spatial pattern
    - Deterministic — same input always produces same output
    - Memory-efficient — no unnecessary image copies
"""

import base64
from typing import Dict, Optional, Tuple
import cv2
import numpy as np

from .config import QualityConfig


def crop_to_oral_region(
    image_bgr: np.ndarray,
    shared: Optional[Dict],
    config: QualityConfig,
) -> np.ndarray:
    """
    Crops the image to the detected oral mucosa bounding box with configurable padding.

    Padding prevents accidentally clipping lesion tissue near the bbox boundary.
    If no bounding box is available, returns the original image unchanged.

    The crop is deterministic and does NOT alter tissue appearance — it only removes
    background area that is irrelevant to the risk model.

    Args:
        image_bgr: Quality-verified BGR uint8 ndarray.
        shared:    Shared feature dict from build_shared_features() (may be None).
        config:    QualityConfig instance (uses config.crop_padding_pct).

    Returns:
        Cropped BGR uint8 ndarray. Same image if bbox is unavailable.
    """
    if shared is None or shared.get("bbox") is None:
        return image_bgr

    h, w = image_bgr.shape[:2]
    x1, y1, x2, y2 = shared["bbox"]

    # Add proportional padding around detected mucosa bbox
    bbox_w = max(x2 - x1, 1)
    bbox_h = max(y2 - y1, 1)
    pad_x = int(bbox_w * config.crop_padding_pct)
    pad_y = int(bbox_h * config.crop_padding_pct)

    cx1 = max(0, x1 - pad_x)
    cy1 = max(0, y1 - pad_y)
    cx2 = min(w, x2 + pad_x)
    cy2 = min(h, y2 + pad_y)

    if cx2 <= cx1 or cy2 <= cy1:
        return image_bgr  # degenerate bbox — skip crop

    return image_bgr[cy1:cy2, cx1:cx2]


def resize_image(
    image_bgr: np.ndarray,
    target_size: Tuple[int, int],
) -> np.ndarray:
    """
    Resizes image to the specified target dimensions.

    Uses INTER_AREA for downscaling (avoids aliasing) and INTER_CUBIC for
    upscaling (preserves fine mucosal texture detail better than bilinear).

    target_size is (width, height) — matches OpenCV convention.
    Member C controls this via QualityConfig.model_input_size without touching
    any other part of the pipeline.

    Returns:
        Resized BGR uint8 ndarray of shape (target_h, target_w, 3).
    """
    target_w, target_h = target_size
    current_h, current_w = image_bgr.shape[:2]

    if current_w == target_w and current_h == target_h:
        return image_bgr

    if current_w > target_w or current_h > target_h:
        interp = cv2.INTER_AREA    # downscale — anti-aliasing
    else:
        interp = cv2.INTER_CUBIC   # upscale — texture-preserving

    return cv2.resize(image_bgr, (target_w, target_h), interpolation=interp)


def enhance_image(
    image_bgr: np.ndarray,
    config: QualityConfig,
) -> np.ndarray:
    """
    Applies lightweight, optional image enhancement to improve clinical usability.

    Enhancement is designed to make images MORE useful for the risk model without
    changing clinically relevant visual information (lesion colour, texture, pattern).

    Step 1 — CLAHE (L-channel of LAB only):
        Enhances local tissue contrast to bring out subtle lesion boundaries.
        Applied only to the luminance channel — colour balance (the reddish-pink
        mucosa hue that indicates tissue health) is completely preserved.

    Step 2 — Bilateral filter:
        Edge-preserving noise reduction. Removes JPEG compression artefacts and
        sensor noise while keeping mucosal lesion boundaries crisp.
        d=5 is the fastest setting with meaningful denoising (suitable for low-end devices).

    If config.apply_enhancement is False, returns the image unchanged.

    CAUTION: Do NOT increase CLAHE clip_limit above 3.0 — aggressive enhancement
    can create halo artefacts around lesion edges and mislead the risk model.

    Returns:
        Enhanced BGR uint8 ndarray (same shape as input).
    """
    if not config.apply_enhancement:
        return image_bgr

    # Step 1: CLAHE on luminance channel only
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(
        clipLimit=config.clahe_clip_limit,
        tileGridSize=config.clahe_tile_size,
    )
    l_enhanced = clahe.apply(l_ch)
    enhanced_bgr = cv2.cvtColor(cv2.merge([l_enhanced, a_ch, b_ch]), cv2.COLOR_LAB2BGR)

    # Step 2: Edge-preserving bilateral filter
    denoised = cv2.bilateralFilter(
        enhanced_bgr,
        d=config.bilateral_d,
        sigmaColor=config.bilateral_sigma_color,
        sigmaSpace=config.bilateral_sigma_space,
    )

    return denoised


def normalize_image(image_bgr: np.ndarray) -> np.ndarray:
    """
    Scales pixel values from [0, 255] uint8 → [0.0, 1.0] float32.

    Standard pre-processing step expected by most PyTorch and TensorFlow CNN models.
    Member C can apply their own per-channel mean/std normalisation on top of this.

    Returns:
        np.ndarray: float32 array with same spatial shape (H, W, 3), values in [0, 1].
    """
    return image_bgr.astype(np.float32) / 255.0


def encode_to_base64(image_bgr: np.ndarray, jpeg_quality: int = 90) -> str:
    """
    Encodes a BGR uint8 image to a JPEG-compressed base64 string for transport.

    This encodes the ENHANCED uint8 image (before normalize_image) so that
    the transported image retains full 8-bit colour fidelity.
    Member C decodes this base64, then applies their own tensor normalisation.

    JPEG quality=90 gives good fidelity with ~60–70% smaller payload than PNG.

    Args:
        image_bgr:    uint8 BGR ndarray — must NOT be the float32 normalized array.
        jpeg_quality: JPEG compression quality (1–100, default 90).

    Returns:
        Base64-encoded UTF-8 string (no data-URI prefix).

    Raises:
        RuntimeError if OpenCV JPEG encoding fails.
    """
    ok, buf = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    if not ok:
        raise RuntimeError("cv2.imencode failed — could not compress image to JPEG.")
    return base64.b64encode(buf.tobytes()).decode("utf-8")
