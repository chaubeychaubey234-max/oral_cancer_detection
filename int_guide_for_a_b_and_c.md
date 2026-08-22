# TobaccoShield — File-Level Integration Guide for Members A, B & C

> **How to read this guide:**
> Every section is written for **one member only**. It tells you exactly which files to create, where to put them, what to name them, and what to write inside — based on what Member D has already built. Do not change any file that isn't listed in your section.

---

## Current Project Layout (What D has already built)

```
oral_cancer_detection/              ← repo root
│
├── app/                            ← Member D's FastAPI backend (DO NOT TOUCH)
│   ├── main.py
│   ├── auth.py
│   ├── config.py
│   ├── database.py
│   ├── error_handling.py
│   ├── models.py
│   ├── schemas.py
│   ├── utils.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── cases.py
│   │   ├── patients.py
│   │   └── sync.py
│   ├── integrations/
│   │   ├── quality_client.py       ← auto-loads Member B's real package
│   │   └── risk_client.py          ← auto-loads Member C's real package
│   └── mocks/
│       ├── quality_stub.py         ← temporary stand-in for Member B
│       └── risk_stub.py            ← temporary stand-in for Member C
│
├── tobaccoshield_quality/          ← Member B's package (PARTIALLY DONE - see B section)
│   ├── __init__.py
│   ├── config.py
│   ├── core.py
│   ├── checks.py
│   ├── preprocessor.py
│   └── api.py
│
├── dashboard/                      ← Member D's doctor dashboard (DO NOT TOUCH)
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── tests/                          ← Member D's end-to-end tests (DO NOT TOUCH)
├── scripts/
│   └── seed_fake_data.py
├── requirements.txt
├── .env / .env.example
├── INTEGRATION_CONTRACT.md         ← FROZEN — read it, don't edit it
└── docker-compose.yml
```

---

---

# 👤 MEMBER B — Image Quality Pipeline

## Status: Package structure EXISTS, but critical piece is MISSING

The folder `tobaccoshield_quality/` already exists with working quality checks. **The one missing piece** is that `core.py::check_image_quality()` does not yet return `processed_image_bytes` — the AI-ready image that Member C's model runs on.

This is the **most critical gap** in the entire integration. Without it, Member C gets the raw camera image, not the cleaned/cropped/normalized one.

---

## Files to MODIFY

### `tobaccoshield_quality/core.py`

**What to change:** Add a call to `make_ai_ready_image()` when the image passes, and include `processed_image_bytes` in the return dict.

Current return dict (missing the critical field):
```python
return {
    "pass": overall_pass,
    "reason": reason,
    "all_failed_reasons": all_failed_reasons,
    "scores": { ... },
    "timestamp": timestamp_iso,
    "module_version": MODULE_VERSION,
}
```

**Required return dict after your change:**
```python
return {
    "pass": overall_pass,
    "reason": reason,
    "all_failed_reasons": all_failed_reasons,
    "scores": {
        "blur_score": float(blur_score),
        "brightness_score": float(brightness_score),
        "glare_area_pct": float(glare_area_pct),
        "framing_confidence": float(framing_confidence),
    },
    "processed_image_bytes": make_ai_ready_image(image_bgr) if overall_pass else None,
    "timestamp": timestamp_iso,
    "module_version": MODULE_VERSION,
}
```

You also need to import `make_ai_ready_image` at the top of `core.py`. That function lives in the file you'll create next.

---

## Files to CREATE

### `tobaccoshield_quality/ai_preprocessor.py`  ← NEW FILE

Create this file inside the `tobaccoshield_quality/` folder.

**Purpose:** Takes the BGR numpy image that already passed quality checks and converts it to the 224×224 JPEG bytes that Member C's model expects.

**Minimum required content:**
```python
"""
AI-Ready Image Preprocessor (Member B)
Crops, resizes, normalizes, and returns JPEG bytes for Member C's risk model.
Target size: 224x224 (confirm with Member C if their model needs a different size).
"""
import io
import cv2
import numpy as np

AI_READY_SIZE = (224, 224)  # confirm with Member C


def make_ai_ready_image(image_bgr: np.ndarray) -> bytes:
    """
    Takes a quality-passed BGR image, crops to the central mucosa ROI,
    resizes to AI_READY_SIZE, applies contrast normalization, and returns
    raw JPEG bytes suitable for Member C's classifier.

    Returns:
        bytes: JPEG-encoded image bytes. NOT base64, NOT a PIL image, NOT a path.
    """
    h, w = image_bgr.shape[:2]

    # 1. Crop to central mucosa region (adjust crop box based on your real detection logic)
    x1, y1 = int(w * 0.15), int(h * 0.15)
    x2, y2 = int(w * 0.85), int(h * 0.85)
    cropped = image_bgr[y1:y2, x1:x2]

    # 2. Resize to model input size
    resized = cv2.resize(cropped, AI_READY_SIZE, interpolation=cv2.INTER_LANCZOS4)

    # 3. Normalize contrast (CLAHE on L channel in LAB space)
    lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    normalized = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 4. Encode to JPEG bytes (raw bytes — not base64)
    success, buffer = cv2.imencode(".jpg", normalized, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not success:
        raise RuntimeError("Failed to encode AI-ready image to JPEG bytes")

    return bytes(buffer)
```

> You can replace the simple crop with your real mucosa-detection bounding box. The important thing is that the function returns raw JPEG `bytes`.

---

### Update `tobaccoshield_quality/__init__.py`

Add `make_ai_ready_image` and `AI_READY_SIZE` to the exports so other modules can import them:

```python
from .config import QualityConfig
from .core import check_image_quality
from .ai_preprocessor import make_ai_ready_image, AI_READY_SIZE

MODULE_VERSION = "1.0.0"

__all__ = ["check_image_quality", "QualityConfig", "make_ai_ready_image", "AI_READY_SIZE", "MODULE_VERSION"]
```

---

## Files to DELETE

None. All existing files stay.

---

## How to Verify Your Work

Run Member D's tests from the repo root:
```bash
cd oral_cancer_detection
pytest -v tests/test_fake_pipeline.py
```

All tests must pass. The test `test_quality_passed_image_has_processed_bytes` specifically checks that `processed_image_bytes` is present and non-null on a passing image.

Also test directly:
```python
from tobaccoshield_quality import check_image_quality

with open("any_clear_photo.jpg", "rb") as f:
    result = check_image_quality(f.read())

assert result["pass"] == True
assert result["processed_image_bytes"] is not None
assert isinstance(result["processed_image_bytes"], bytes)
print("Image size check:", len(result["processed_image_bytes"]), "bytes — OK")
```

---

---

# 👤 MEMBER C — AI Risk Classification

## Status: Package does NOT exist yet. You build it from scratch.

Member D's backend will auto-detect your package the moment it's importable. You do not need to touch any of Member D's files. Just create the `tobaccoshield_risk/` folder and its contents.

---

## Folder to CREATE

Create this folder inside `oral_cancer_detection/` (same level as `tobaccoshield_quality/` and `app/`):

```
oral_cancer_detection/
└── tobaccoshield_risk/              ← CREATE THIS FOLDER
    ├── __init__.py                  ← CREATE
    ├── model.py                     ← CREATE (your inference logic)
    └── heatmap.py                   ← CREATE (your Grad-CAM logic)
```

---

## Files to CREATE

### `tobaccoshield_risk/__init__.py`

```python
"""
TobaccoShield AI Risk Classification Module (Member C)
"""
from .model import classify_risk

__all__ = ["classify_risk"]
```

---

### `tobaccoshield_risk/model.py`

This is your main file. The function signature and return shape **must match exactly**:

```python
"""
AI Risk Classification for Oral Cancer Detection.
Receives Member B's preprocessed 224x224 JPEG image bytes.
Returns risk category, confidence score, and optional Grad-CAM heatmap.
"""
from typing import Optional
from datetime import datetime, timezone

MODEL_VERSION = "1.0.0"  # update when you retrain


def classify_risk(image_bytes: bytes, config: dict | None = None) -> dict:
    """
    Classifies oral cancer risk from a quality-passed, preprocessed image.

    Args:
        image_bytes (bytes): Raw JPEG bytes from Member B's processed_image_bytes.
                             This is a 224x224 cropped/normalized image — NOT the raw camera photo.
        config (dict | None): Optional override params (ignore if you don't need it).

    Returns dict with EXACTLY these keys:
        {
          "risk_category": "low" | "medium" | "high" | "cannot_assess",
          "confidence": float,              # 0.0 to 1.0
          "cannot_assess": bool,
          "cannot_assess_reason": str | None,
          "heatmap_png_bytes": bytes | None,  # PNG bytes of Grad-CAM overlay, or None
          "model_version": str,
          "timestamp": str,                 # ISO8601 UTC string
        }
    """
    # --- YOUR MODEL INFERENCE CODE GOES HERE ---
    # Example structure:

    import numpy as np
    import io
    from PIL import Image

    # 1. Decode image bytes → numpy array for your model
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(img) / 255.0  # normalize to [0,1]

    # 2. Run your trained model
    # predictions = your_model.predict(img_array[np.newaxis, ...])

    # 3. Decide risk category and confidence
    # ... your logic ...

    # 4. Handle cannot_assess case (model confidence below safe threshold)
    # If your softmax max probability < 0.4, return cannot_assess:
    # return {
    #     "risk_category": "cannot_assess",
    #     "confidence": float(max_prob),
    #     "cannot_assess": True,
    #     "cannot_assess_reason": "Model confidence below safe threshold for this image.",
    #     "heatmap_png_bytes": None,
    #     "model_version": MODEL_VERSION,
    #     "timestamp": datetime.now(timezone.utc).isoformat(),
    # }

    # 5. Generate heatmap (see heatmap.py)
    # from .heatmap import generate_gradcam
    # heatmap_bytes = generate_gradcam(img_array, your_model, predicted_class)

    return {
        "risk_category": "low",           # replace with your real prediction
        "confidence": 0.85,               # replace with your real confidence
        "cannot_assess": False,
        "cannot_assess_reason": None,
        "heatmap_png_bytes": None,        # replace with heatmap_bytes from your Grad-CAM
        "model_version": MODEL_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
```

**Critical rules:**
- `risk_category` must be one of: `"low"`, `"medium"`, `"high"`, `"cannot_assess"` — no other strings
- `confidence` must be a float between `0.0` and `1.0`
- `heatmap_png_bytes` must be **PNG bytes** (not JPEG, not base64, not a file path) — or `None`
- When `cannot_assess=True`, set `risk_category` to `"cannot_assess"` as well

---

### `tobaccoshield_risk/heatmap.py`

```python
"""
Grad-CAM / suspicious region heatmap generator.
Returns PNG bytes of a heatmap overlay on the input image.
"""
import io
import numpy as np
from PIL import Image


def generate_gradcam(image_array: np.ndarray, model, class_index: int) -> bytes:
    """
    Generates a Grad-CAM heatmap and overlays it on the original image.

    Args:
        image_array: Input image as numpy array (H, W, 3), values in [0,1].
        model: Your loaded Keras/PyTorch model.
        class_index: The predicted class index to explain.

    Returns:
        bytes: PNG-encoded heatmap overlay image bytes.
               Must be same or near-same dimensions as the input image.
    """
    # --- YOUR GRAD-CAM LOGIC HERE ---
    # For Keras example:
    # import tensorflow as tf
    # with tf.GradientTape() as tape:
    #     last_conv_layer_model = ...
    #     classifier_model = ...
    #     last_conv_layer_output, preds = ...
    #     pred_index = tf.argmax(preds[0])
    #     class_channel = preds[:, pred_index]
    # grads = tape.gradient(class_channel, last_conv_layer_output)
    # heatmap = ... normalize and overlay ...

    # Return the PNG bytes:
    # buf = io.BytesIO()
    # overlay_image.save(buf, format="PNG")
    # return buf.getvalue()

    # Placeholder: return None if you haven't implemented this yet
    return None
```

---

## Files to MODIFY

### `requirements.txt` — ADD your model dependencies

Open `oral_cancer_detection/requirements.txt` and add the libraries your model needs. Example:
```
tensorflow>=2.15          # or torch>=2.0, depending on your framework
opencv-python>=4.9
```

Do not remove any existing lines — only add new ones at the bottom.

---

### `.env` — Enable your real module

Open `oral_cancer_detection/.env` and confirm this line is set:
```
USE_REAL_RISK_MODULE=true
```
It should already be `true` by default.

---

## Files to DELETE

None.

---

## How to Get Quality-Passed Training Images

Member D's backend already has an endpoint for this:

```
GET /cases?status_filter=quality_passed
Authorization: Bearer <your_jwt_token>
```

This returns a list of cases that passed Member B's quality check. For each case, download the preprocessed image (the one Member C should train on):

```
GET /cases/{case_id}/processed-image
Authorization: Bearer <your_jwt_token>
```

This is a `200 OK` with the JPEG image bytes — this is exactly what your model will receive at inference time.

---

## How to Verify Your Work

```bash
cd oral_cancer_detection
pytest -v tests/test_fake_pipeline.py
```

Then test your module directly:
```python
from tobaccoshield_risk import classify_risk

with open("any_224x224_processed_image.jpg", "rb") as f:
    result = classify_risk(f.read())

assert result["risk_category"] in ("low", "medium", "high", "cannot_assess")
assert 0.0 <= result["confidence"] <= 1.0
assert isinstance(result["cannot_assess"], bool)
assert result["heatmap_png_bytes"] is None or isinstance(result["heatmap_png_bytes"], bytes)
print("All checks passed:", result["risk_category"], result["confidence"])
```

---

---

# 👤 MEMBER A — Mobile App

## Status: No mobile folder exists yet. You build it from scratch.

Member D's backend is running and ready. You connect your app to it via HTTP. You do not need to create any backend files. Create your app code in a new `mobile/` folder.

---

## Folder to CREATE

```
oral_cancer_detection/
└── mobile/                          ← CREATE THIS FOLDER (React Native, Flutter, etc.)
    ├── ...your app files...
```

The technology (React Native, Flutter, Kotlin, etc.) is your choice. What matters is the API calls you make.

---

## Files to MODIFY in the backend (only 2 situations)

### 1. If you need CORS changes — `app/main.py`

Currently CORS is open (`allow_origins=["*"]`). For production, change line 31:
```python
# Change this:
allow_origins=["*"],
# To your app's origin, e.g.:
allow_origins=["http://localhost:3000", "http://your-app-domain.com"],
```

### 2. Nothing else. Do not touch any other backend file.

---

## API Endpoints to Call (all hosted by Member D's backend)

### Step 1 — Authentication

**Register a new user (do once, or use seed script):**
```
POST http://localhost:8000/auth/register
Content-Type: application/json

{
  "username": "worker1",
  "password": "password123",
  "full_name": "Health Worker Name",
  "role": "health_worker"
}
```

**Login to get JWT token:**
```
POST http://localhost:8000/auth/login
Content-Type: application/x-www-form-urlencoded

username=worker1&password=password123
```

Response:
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": { "id": "...", "username": "worker1", "role": "health_worker" }
}
```

Store the `access_token`. Add it to all subsequent requests as:
```
Authorization: Bearer eyJhbGci...
```

---

### Step 2 — Register a Patient (Online)

```
POST http://localhost:8000/patients
Authorization: Bearer <token>
Content-Type: application/json

{
  "client_uuid": "a1b2c3d4-...",    ← generate once on-device, reuse on retries
  "name": "Ram Prasad",
  "age": 45,
  "sex": "male",
  "phone": "9876543210",
  "village_or_facility": "Rampur PHC",
  "tobacco_type": "khaini"
}
```

Response gives you `"id"` — save this as `server_patient_id`.

---

### Step 3 — Upload a Capture (Online Flow)

```
POST http://localhost:8000/cases
Authorization: Bearer <token>
Content-Type: multipart/form-data

Fields:
  patient_id    = <server_patient_id from step 2>
  file          = <the JPEG image file from camera>
  client_uuid   = <a new UUID you generate for this case>
  device_info   = "Samsung Galaxy A32 / Android 12"  (optional)
```

Response is the full case object:
```json
{
  "id": "case-server-id",
  "status": "risk_assessed",
  "quality_audit": {
    "passed": true,
    "reason": null,
    "all_failed_reasons": [],
    "blur_score": 142.5,
    ...
  },
  "risk_assessment": {
    "risk_category": "low",
    "confidence": 0.83,
    "cannot_assess": false,
    ...
  }
}
```

**If `quality_audit.passed == false`:** Show the retake screen. The list of reasons to show the user is in `quality_audit.all_failed_reasons`:
```
["blur", "bad_framing"]   → "Photo is blurry and incorrectly framed. Please retake."
["underexposed"]          → "Photo is too dark. Move to a brighter area."
["glare"]                 → "Too much glare/reflection. Avoid direct flash."
```

---

### Step 4 — Offline Sync (when connectivity returns)

Batch-upload everything captured offline in a single call:

```
POST http://localhost:8000/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "patients": [
    {
      "client_uuid": "device-generated-uuid-for-patient",
      "name": "Ram Prasad",
      "age": 45,
      "sex": "male",
      "phone": "9876543210",
      "village_or_facility": "Rampur PHC",
      "client_updated_at": "2026-08-20T10:00:00Z"
    }
  ],
  "cases": [
    {
      "client_uuid": "device-generated-uuid-for-case",
      "patient_client_uuid": "device-generated-uuid-for-patient",
      "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
      "captured_at": "2026-08-20T10:05:00Z",
      "device_info": "Samsung Galaxy A32",
      "client_updated_at": "2026-08-20T10:05:00Z"
    }
  ]
}
```

Response tells you which records were created, updated, or conflicted:
```json
{
  "patients": [{ "client_uuid": "...", "server_id": "...", "status": "created" }],
  "cases":    [{ "client_uuid": "...", "server_id": "...", "status": "created" }]
}
```

**Important:** If a case `status` is `"conflict"`, it means a doctor reviewed it server-side while you were offline — do not overwrite it. Show the user that the case was already reviewed.

---

### Step 5 — Patient History

```
GET http://localhost:8000/patients/{server_patient_id}/cases
Authorization: Bearer <token>
```

Returns a list of all cases for that patient with their current status and risk category.

---

### Step 6 — Case Detail (for retake or result screen)

```
GET http://localhost:8000/cases/{case_id}
Authorization: Bearer <token>
```

Returns the full case object including quality audit and risk assessment.

---

## Generating `client_uuid` on device

Generate once per record using a UUID v4 library. **Never regenerate on retry** — the same UUID is what makes sync idempotent:

```javascript
// React Native example
import uuid from 'react-native-uuid';
const patientId = uuid.v4();   // store in local DB with the patient record
const caseId = uuid.v4();      // store with the case record
```

---

## Error Shape

Every error from every endpoint looks the same — one parsing path for your app:
```json
{
  "error": {
    "code": "not_found",
    "message": "patient not found",
    "detail": null
  }
}
```

Common codes: `bad_request` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `validation_error` (422).

---

## Files to DELETE

None.

---

## How to Verify Your Work

Run Member D's backend locally:
```bash
cd oral_cancer_detection
uvicorn app.main:app --reload
```

Then test each endpoint using the Swagger UI at:
```
http://localhost:8000/docs
```

Or run the test suite to confirm the backend side is healthy:
```bash
pytest -v
```
