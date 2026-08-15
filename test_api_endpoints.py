"""
FastAPI Server Endpoint Verification Script.
Starts FastAPI test app via starlette TestClient and verifies:
1. GET /health
2. GET /contract
3. POST /check-image-quality with Base64 JSON payload
4. POST /check-image-quality with Multipart file upload
"""

import base64
from pathlib import Path
from fastapi.testclient import TestClient

from tobaccoshield_quality.api import app

client = TestClient(app)

def test_api():
    print("Testing FastAPI endpoints...\n")

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print(" [✓] GET /health -> Status 200:", res.json())

    # 2. Contract spec
    res = client.get("/contract")
    assert res.status_code == 200, f"Contract endpoint failed: {res.text}"
    print(" [✓] GET /contract -> Status 200 OK")

    # 3. POST /check-image-quality with Base64 payload
    good_img_path = Path("sample_images/01_good_mucosa.jpg")
    with open(good_img_path, "rb") as f:
        b64_str = base64.b64encode(f.read()).decode("utf-8")

    res = client.post(
        "/check-image-quality",
        json={"image_base64": f"data:image/jpeg;base64,{b64_str}"}
    )
    assert res.status_code == 200, f"Base64 endpoint failed: {res.text}"
    data = res.json()
    assert data["pass"] is True
    assert data["reason"] is None
    assert "blur_score" in data["scores"]
    print(" [✓] POST /check-image-quality (Base64 JSON payload) ->", data)

    # 4. POST /check-image-quality with Multipart file upload
    with open(good_img_path, "rb") as f:
        res = client.post(
            "/check-image-quality",
            files={"file": ("01_good_mucosa.jpg", f, "image/jpeg")}
        )
    assert res.status_code == 200, f"Multipart upload failed: {res.text}"
    data_mp = res.json()
    assert data_mp["pass"] is True
    print(" [✓] POST /check-image-quality (Multipart Form payload) ->", data_mp)

    # 5. Test failure case (Blurry image)
    blurry_path = Path("sample_images/02_blurry_mucosa.jpg")
    with open(blurry_path, "rb") as f:
        res = client.post(
            "/check-image-quality",
            files={"file": ("02_blurry_mucosa.jpg", f, "image/jpeg")}
        )
    assert res.status_code == 200
    data_blur = res.json()
    assert data_blur["pass"] is False
    assert data_blur["reason"] == "blur"
    print(" [✓] POST /check-image-quality (Blurry Multipart file) ->", data_blur)

    print("\nAll FastAPI endpoints successfully validated!")

if __name__ == "__main__":
    test_api()
