"""
Image Input Preprocessor and Format Normalizer.
Converts various image input formats (bytes, base64, file path, PIL image, numpy array)
into a standard 3-channel OpenCV BGR numpy matrix.
"""

import base64
import io
from pathlib import Path
from typing import Union
import cv2
import numpy as np

ImageInputType = Union[bytes, bytearray, str, Path, np.ndarray]


def load_image_to_bgr(image_input: ImageInputType) -> np.ndarray:
    """
    Decodes diverse input types into a standard 3-channel BGR OpenCV image.

    Supported inputs:
    - bytes or bytearray: raw binary file bytes (JPEG/PNG/WEBP)
    - str (base64): Base64 encoded image string (with or without 'data:image/...;base64,' header)
    - str or Path: local filesystem image path
    - np.ndarray: pre-loaded BGR image matrix

    Returns:
        np.ndarray: 3-channel BGR uint8 numpy matrix.

    Raises:
        ValueError: If input format is invalid, empty, or cannot be decoded by OpenCV.
    """
    if image_input is None:
        raise ValueError("Image input cannot be None.")

    # 1. Direct numpy array
    if isinstance(image_input, np.ndarray):
        if image_input.size == 0:
            raise ValueError("Input numpy array is empty.")
        if len(image_input.shape) == 2:
            # Grayscale -> convert to BGR
            return cv2.cvtColor(image_input, cv2.COLOR_GRAY2BGR)
        elif len(image_input.shape) == 3 and image_input.shape[2] == 4:
            # BGRA -> convert to BGR
            return cv2.cvtColor(image_input, cv2.COLOR_BGRA2BGR)
        elif len(image_input.shape) == 3 and image_input.shape[2] == 3:
            return image_input
        else:
            raise ValueError(f"Unsupported numpy array shape: {image_input.shape}")

    # 2. File path (str or Path)
    if isinstance(image_input, Path) or (isinstance(image_input, str) and not image_input.startswith("data:") and not _is_base64_string(image_input)):
        path_str = str(image_input)
        if not Path(path_str).is_file():
            # Check if it looks like a failed path before raising
            raise ValueError(f"Image file does not exist at path: {path_str}")
        img = cv2.imread(path_str, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Failed to read image file at path: {path_str}")
        return img

    # 3. Base64 string
    if isinstance(image_input, str):
        raw_b64 = image_input
        if raw_b64.startswith("data:"):
            # Strip data URI scheme e.g. "data:image/jpeg;base64,..."
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(raw_b64)
            return _decode_bytes_to_bgr(image_bytes)
        except Exception as e:
            raise ValueError(f"Failed to decode base64 image data: {str(e)}")

    # 4. Raw bytes or bytearray
    if isinstance(image_input, (bytes, bytearray)):
        return _decode_bytes_to_bgr(bytes(image_input))

    raise ValueError(f"Unsupported image input type: {type(image_input)}")


def _is_base64_string(s: str) -> bool:
    """Heuristic helper to check if a string is base64 encoded data rather than a file path."""
    if len(s) < 100:  # File paths are usually short, base64 payload of an image is long
        return False
    try:
        # Check if characters are valid base64
        base64.b64decode(s[:64], validate=True)
        return True
    except Exception:
        return False


def _decode_bytes_to_bgr(image_bytes: bytes) -> np.ndarray:
    """Decodes raw binary image bytes (JPEG/PNG/WEBP) using OpenCV imdecode."""
    if not image_bytes:
        raise ValueError("Image bytes input is empty.")
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("OpenCV imdecode failed. The byte buffer is not a valid image format.")
    return img
