# TobaccoShield - Image Quality & Preprocessing Module Integration Guide
**Author**: Member B (Image Quality & Preprocessing Lead)  
**Module Version**: `1.0.0`  
**Target Platform**: Python OpenCV (Backend / AI Pipeline) & On-Device TFLite / C++ Portable Engine  

---

## 1. Overview & Single Entry-Point Interface

The `tobaccoshield_quality` package provides a unified image quality gatekeeper for buccal mucosa photos prior to AI risk classification.

### Single Entry-Point Function
All team members (A, C, D) interact with a single Python entry point:
```python
from tobaccoshield_quality import check_image_quality, QualityConfig

# image_input can be raw bytes, base64 string, file path, or BGR numpy array
result = check_image_quality(image_input)
```

---

## 2. Standardized Team Contract (JSON Schema)

Every check returns a JSON-serializable dictionary adhering strictly to the contract below:

```json
{
  "pass": true,
  "reason": null,
  "scores": {
    "blur_score": 142.5,
    "brightness_score": 128.4,
    "glare_area_pct": 0.8,
    "framing_confidence": 0.88
  },
  "timestamp": "2026-08-15T14:58:28Z",
  "module_version": "1.0.0"
}
```

### Contract Key Rules
1. **`pass`** (`boolean`): `true` if all 4 quality checks pass; `false` if any check fails.
2. **`reason`** (`string | null`): Reflects the **FIRST failing check** in priority order:
   - `"blur"`: Blur score < `BLUR_THRESHOLD`
   - `"underexposed"`: Brightness score < `BRIGHTNESS_MIN`
   - `"overexposed"`: Brightness score > `BRIGHTNESS_MAX`
   - `"glare"`: Glare area % > `MAX_GLARE_AREA_PCT`
   - `"bad_framing"`: Framing confidence < `MIN_FRAMING_CONFIDENCE`
   - `null`: When `pass` is `true`.
3. **`scores`** (`object`): **ALWAYS includes all 4 numeric scores**, regardless of whether the image passed or failed.
4. **`timestamp`** (`ISO8601 string`): UTC timestamp of processing time.
5. **`module_version`** (`string`): Current release version (`1.0.0`).

---

## 3. Member A (React Native Mobile App Integration)

Member A calls the quality check endpoint immediately after a camera frame is captured.

### API Endpoint: `POST /check-image-quality`

#### Option 1: Base64 JSON Payload (Recommended for React Native Camera)
```json
POST /check-image-quality
Content-Type: application/json

{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."
}
```

#### Option 2: Multipart Form Upload
```bash
curl -X POST "http://localhost:8000/check-image-quality" \
  -F "file=@sample_images/01_good_mucosa.jpg"
```

### React Native Integration Code Snippet
```javascript
import React from 'react';
import { RNCamera } from 'react-native-camera';

const takePhotoAndCheckQuality = async (camera) => {
  const options = { quality: 0.8, base64: true };
  const data = await camera.takePictureAsync(options);

  const response = await fetch('https://api.tobaccoshield.org/check-image-quality', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: data.base64 }),
  });

  const result = await response.json();

  if (!result.pass) {
    // Prompt retake with specific user message based on reason
    const userMessages = {
      blur: "Photo is blurry. Please hold the phone steady and tap to focus.",
      underexposed: "Lighting is too dark. Turn on camera flash or move to a bright area.",
      overexposed: "Photo is too bright/washed out. Avoid direct harsh light.",
      glare: "Flash reflection detected on mucosa. Adjust camera angle slightly.",
      bad_framing: "Oral mucosa not detected. Ensure the cheek/lip is centered in frame.",
    };
    showRetakeModal(userMessages[result.reason]);
    return;
  }

  // Quality check passed! Proceed to AI risk assessment
  proceedToRiskAssessment(data.uri, result.scores);
};
```

---

## 4. Member C (AI Risk Model Pipeline Integration)

Member C directly imports `check_image_quality()` to filter incoming training/inference images and log quality scores alongside model predictions.

### Direct In-Process Python Call
```python
from tobaccoshield_quality import check_image_quality

def process_patient_screening(image_bytes: bytes):
    # 1. Quality pre-check
    quality = check_image_quality(image_bytes)
    
    if not quality["pass"]:
        print(f"Skipping risk model due to quality issue: {quality['reason']}")
        return {
            "status": "REJECTED_QUALITY",
            "quality_audit": quality
        }

    # 2. Risk classification model inference
    risk_score, risk_label = run_ai_risk_model(image_bytes)

    # 3. Combine model prediction with pre-calculated quality audit scores
    return {
        "status": "PROCESSED",
        "risk_score": risk_score,
        "risk_label": risk_label,
        "quality_scores": quality["scores"]  # Logged for false-negative debugging
    }
```

### Portability & On-Device C++ / TFLite Note
The core checks in `tobaccoshield_quality/checks.py` rely strictly on primitive matrix operations:
- `cv2.Laplacian` (Spatial convolution kernel: `[[0, 1, 0], [1, -4, 1], [0, 1, 0]]`)
- Grayscale / YCrCb / HSV color transformations
- Pixel intensity counts (`countNonZero`)

No complex Python-only dependencies are used, allowing direct C++ / Android NDK / TFLite C API porting for full offline on-device execution.

---

## 5. Member D (Backend & Doctor Dashboard Integration)

Member D embeds the FastAPI application or calls `check_image_quality` in the server backend, storing audit scores in PostgreSQL for doctor review.

### Recommended PostgreSQL Database Schema Table
```sql
CREATE TABLE image_quality_audits (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    image_id VARCHAR(64) UNIQUE NOT NULL,
    passed BOOLEAN NOT NULL,
    failure_reason VARCHAR(32),
    blur_score FLOAT NOT NULL,
    brightness_score FLOAT NOT NULL,
    glare_area_pct FLOAT NOT NULL,
    framing_confidence FLOAT NOT NULL,
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    module_version VARCHAR(16) NOT NULL
);
```

### Storing Quality Results in FastAPI Backend
```python
from fastapi import APIRouter
from tobaccoshield_quality import check_image_quality

router = APIRouter()

@router.post("/patient/{patient_id}/upload-photo")
async def handle_photo_upload(patient_id: str, image_bytes: bytes, db: Session):
    # Execute quality check
    quality_res = check_image_quality(image_bytes)

    # Log structured quality audit record in PostgreSQL
    db_audit = QualityAudit(
        patient_id=patient_id,
        passed=quality_res["pass"],
        failure_reason=quality_res["reason"],
        blur_score=quality_res["scores"]["blur_score"],
        brightness_score=quality_res["scores"]["brightness_score"],
        glare_area_pct=quality_res["scores"]["glare_area_pct"],
        framing_confidence=quality_res["scores"]["framing_confidence"],
        module_version=quality_res["module_version"]
    )
    db.add(db_audit)
    db.commit()

    return quality_res
```

---

## 6. Threshold Configuration Reference

All thresholds are defined as named constants in `tobaccoshield_quality/config.py`.

| Parameter | Named Constant | Default Value | Description |
| :--- | :--- | :--- | :--- |
| Blur Cutoff | `DEFAULT_BLUR_THRESHOLD` | `100.0` | Laplacian variance min score. |
| Brightness Min | `DEFAULT_BRIGHTNESS_MIN` | `40.0` | Grayscale luminance min (0-255). |
| Brightness Max | `DEFAULT_BRIGHTNESS_MAX` | `215.0` | Grayscale luminance max (0-255). |
| Glare Area Max | `DEFAULT_MAX_GLARE_AREA_PCT` | `5.0%` | Specular highlight % max limit. |
| Framing Min | `DEFAULT_MIN_FRAMING_CONFIDENCE` | `0.50` | Mucosa probability min threshold. |

Custom thresholds can be passed at runtime via `QualityConfig`:
```python
custom_config = QualityConfig(
    blur_threshold=120.0,
    max_glare_area_pct=3.5
)
result = check_image_quality(image_bytes, config=custom_config)
```
