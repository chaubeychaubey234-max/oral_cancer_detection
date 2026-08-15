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
  "all_failed_reasons": [],
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
2. **`reason`** (`string | null`): Reflects the **FIRST failing check** in agreed priority order:
   - `"blur"`: Blur score < `BLUR_THRESHOLD`
   - `"underexposed"`: Brightness score < `BRIGHTNESS_MIN`
   - `"overexposed"`: Brightness score > `BRIGHTNESS_MAX`
   - `"glare"`: Glare area % > `MAX_GLARE_AREA_PCT`
   - `"bad_framing"`: Framing confidence < `MIN_FRAMING_CONFIDENCE`
   - `null`: When `pass` is `true`.
3. **`all_failed_reasons`** (`array of strings`): Contains **ALL failing checks** (e.g. `["blur", "bad_framing"]`). Useful for Member A when presenting detailed user feedback or logging multi-failure states.
4. **`scores`** (`object`): **ALWAYS includes all 4 numeric scores**, regardless of whether the image passed or failed.
5. **`timestamp`** (`ISO8601 string`): UTC timestamp of processing time.
6. **`module_version`** (`string`): Current release version (`1.0.0`).

---

## 3. Failure Reason Priority & UI Guidance for Member A

### Priority Order Evaluation
When multiple checks fail on a single photo (for example, an image that is both out of focus AND misframed), `check_image_quality()` evaluates checks in this exact sequence:
1. `blur`
2. `underexposed` / `overexposed`
3. `glare`
4. `bad_framing`

The primary `"reason"` string returns the **first** failing check in this list.

### Recommendation for Member A (React Native Mobile UI)
> [!IMPORTANT]
> **Multi-Failure Retake Prompting**: If `result.all_failed_reasons` has more than 1 item (e.g. `["blur", "bad_framing"]`), do NOT assume `result.reason` is the only problem.  
> 
> Member A can handle retake prompts in one of two ways:
> - **Option A (Comprehensive retake message)**: Check `result.all_failed_reasons` to display a combined message (e.g., *"Photo is blurry and misframed. Hold steady and center the inner cheek in frame."*)
> - **Option B (Generic fallback)**: If `all_failed_reasons.length > 1`, display a clear generic prompt: *"Photo quality insufficient. Please re-align camera and tap to focus."*

---

## 4. Member A (React Native Mobile App Integration)

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

---

## 5. Member C (AI Risk Model Pipeline Integration) & Threshold Calibration

Member C directly imports `check_image_quality()` to filter incoming training/inference images and log quality scores alongside model predictions.

### Real Camera Threshold Calibration Notice
> [!WARNING]
> **Calibrating Against Real Physical Camera Photos**:  
> Initial default thresholds (`BLUR_THRESHOLD = 100.0`, brightness `40–215`, glare `5%`) were established using synthetic noise models. Real smartphone cameras (iOS/Android) introduce physical optical factors:
> - **Lens Autofocus & Motion Blur**: Real 12MP/48MP phone sensors compressed to JPEG may yield higher Laplacian variance (e.g., 200–500 for sharp images, <80 for blurry ones).
> - **Camera Flash Color Temperature**: Direct LED flash on moist mucosa creates localized specular highlights.
> 
> **Action before Member C model training**: Collect 15–20 real clinical/stock buccal mucosa photos, run `python3 test_quality_checker.py <real_photos_dir>`, and adjust thresholds in `QualityConfig` as needed.

### Direct In-Process Python Call
```python
from tobaccoshield_quality import check_image_quality

def process_patient_screening(image_bytes: bytes):
    # 1. Quality pre-check
    quality = check_image_quality(image_bytes)
    
    if not quality["pass"]:
        print(f"Skipping risk model due to quality issues: {quality['all_failed_reasons']}")
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

---

## 6. Member D (Backend & Doctor Dashboard Integration)

Member D embeds the FastAPI application or calls `check_image_quality` in the server backend, storing audit scores in PostgreSQL for doctor review.

### Recommended PostgreSQL Database Schema Table
```sql
CREATE TABLE image_quality_audits (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    image_id VARCHAR(64) UNIQUE NOT NULL,
    passed BOOLEAN NOT NULL,
    failure_reason VARCHAR(32),
    all_failed_reasons TEXT[],  -- Array of all failing check reasons
    blur_score FLOAT NOT NULL,
    brightness_score FLOAT NOT NULL,
    glare_area_pct FLOAT NOT NULL,
    framing_confidence FLOAT NOT NULL,
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    module_version VARCHAR(16) NOT NULL
);
```

---

## 7. Framing Check Edge-Case Discrimination Reference

The framing check (`check_framing`) evaluates inner buccal mucosa presence while actively discriminating against edge cases:

| Scenario | Expected Framing Confidence | Behavior & Penalties |
| :--- | :--- | :--- |
| **Centered Inner Mucosa** | `0.70 – 0.99` | High YCrCb chrominance match in central ROI. Passes check. |
| **Outer Lips Only** | `0.15 – 0.40` | Outer vermilion border & facial skin detected; lacks inner mucosa red-chrominance in central 60% ROI. Marked `bad_framing`. |
| **Teeth Dominant Frame** | `0.05 – 0.35` | High white luminance & low chrominance variation in center triggers teeth penalty. Marked `bad_framing`. |
| **Deep Oral Shadow Void** | `0.00 – 0.30` | Central luminance $Y < 35$ triggers dark void penalty. Marked `bad_framing`. |
| **Distant Shot (Far away)**| `0.10 – 0.45` | Mucosal tissue occupies $<20\%$ of frame. Marked `bad_framing`. |

---

## 8. Threshold Configuration Reference

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
