"""
TobaccoShield AI Risk Classification Module (Member C)
Oral Cancer Classification using MobileNetV2
"""
from .model import classify_risk, predict_image, get_model, CLASS_NAMES

__all__ = ["classify_risk", "predict_image", "get_model", "CLASS_NAMES"]
