"""
Generates small synthetic images that exercise Member D's bundled quality/risk
stubs in predictable ways (good / blurry / dark / bad-framing), without
depending on OpenCV so these tests run in any minimal Member D dev env.

If you're testing against Member B's REAL tobaccoshield_quality package,
prefer the images produced by generate_test_samples.py in this repo instead -
these are only tuned against Member D's stub heuristics.
"""
import io

import numpy as np
from PIL import Image, ImageFilter


def _to_jpeg_bytes(img: Image.Image, quality=85) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def good_mucosa_image_bytes(width=320, height=240) -> bytes:
    """Pinkish, textured, well-lit - should PASS the stub quality check."""
    base = np.zeros((height, width, 3), dtype=np.float32)
    base[:, :] = (210, 115, 110)  # RGB: pinkish-red
    noise = np.random.normal(0, 18, base.shape).astype(np.float32)
    arr = np.clip(base + noise, 0, 255).astype(np.uint8)
    return _to_jpeg_bytes(Image.fromarray(arr))


def blurry_mucosa_image_bytes(width=320, height=240) -> bytes:
    img_bytes = good_mucosa_image_bytes(width, height)
    img = Image.open(io.BytesIO(img_bytes))
    blurred = img.filter(ImageFilter.GaussianBlur(radius=12))
    return _to_jpeg_bytes(blurred)


def dark_mucosa_image_bytes(width=320, height=240) -> bytes:
    base = np.zeros((height, width, 3), dtype=np.float32)
    base[:, :] = (25, 12, 12)
    noise = np.random.normal(0, 4, base.shape).astype(np.float32)
    arr = np.clip(base + noise, 0, 255).astype(np.uint8)
    return _to_jpeg_bytes(Image.fromarray(arr))


def bad_framing_image_bytes(width=320, height=240) -> bytes:
    """Cool dark-blue background with no mucosa-pink content - should FAIL framing."""
    base = np.zeros((height, width, 3), dtype=np.float32)
    base[:, :] = (20, 50, 180)  # RGB: bluish
    noise = np.random.normal(0, 10, base.shape).astype(np.float32)
    arr = np.clip(base + noise, 0, 255).astype(np.uint8)
    return _to_jpeg_bytes(Image.fromarray(arr))
