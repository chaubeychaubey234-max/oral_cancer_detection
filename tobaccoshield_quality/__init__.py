"""
TobaccoShield Image Quality & Preprocessing Module (Member B)
============================================================
Provides unified image quality verification for buccal mucosa photos prior to AI risk classification.
"""

from .config import QualityConfig
from .core import check_image_quality

MODULE_VERSION = "1.0.0"

__all__ = ["check_image_quality", "QualityConfig", "MODULE_VERSION"]
