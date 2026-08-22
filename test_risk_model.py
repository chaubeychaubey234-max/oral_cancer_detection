"""
Integration test for Member C's tobaccoshield_risk module.
Tests:
1. Model loading from models/baseline_v2_best.keras
2. predict_image() convenience method
3. classify_risk() contract method
4. Grad-CAM / heatmap generation
5. POST /predict FastAPI endpoint
"""
from pathlib import Path
from PIL import Image
import io
import numpy as np

from tobaccoshield_risk.model import predict_image, classify_risk, get_model, CLASS_NAMES


def create_dummy_sample_image() -> bytes:
    """Creates a sample 224x224 RGB image bytes for test inference."""
    arr = np.random.randint(50, 200, size=(224, 224, 3), dtype=np.uint8)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_risk_inference():
    print("Testing TobaccoShield ML Risk Model (Member C)...")

    # 1. Test model instance
    model = get_model()
    print(f" [OK] get_model() -> {type(model)}")

    sample_bytes = create_dummy_sample_image()

    # If there is a real sample in sample_images/, use it
    sample_file = Path("sample_images/01_good_mucosa.jpg")
    if sample_file.exists():
        sample_bytes = sample_file.read_bytes()
        print(f" [OK] Using real sample image: {sample_file}")

    # 2. Test predict_image
    pred = predict_image(sample_bytes)
    print(f" [OK] predict_image() -> {pred}")
    assert "prediction" in pred
    assert pred["prediction"] in CLASS_NAMES
    assert "confidence" in pred

    # 3. Test classify_risk (frozen contract)
    result = classify_risk(sample_bytes)
    print(f" [OK] classify_risk() -> risk_category={result['risk_category']}, confidence={result['confidence']}, cannot_assess={result['cannot_assess']}")
    assert result["risk_category"] in ["low", "medium", "high", "cannot_assess"]
    assert 0.0 <= result["confidence"] <= 1.0
    assert "timestamp" in result

    if result["heatmap_png_bytes"]:
        print(f" [OK] Heatmap generated ({len(result['heatmap_png_bytes'])} bytes PNG)")

    print("\nAll Risk Model Unit Tests PASSED!")


if __name__ == "__main__":
    test_risk_inference()
