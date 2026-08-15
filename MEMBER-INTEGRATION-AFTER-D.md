# TobaccoShield — Member Integration Guide (After Member D)

**Backend authored by: Member D**  
**File**: `MEMBER-INTEGRATION-AFTER-D.md`

This document tells each team member exactly what to clone, install, replace, and implement to plug their work into Member D's backend. Read only the section that applies to you.

---

## 🔧 One-Time Setup (Everyone)

Everyone needs the backend running locally first.

```bash
# 1. Clone / pull the latest repo
git clone <repo-url>
cd oral_cancer_detection

# 2. Create a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# 3. Install all dependencies
pip install -r requirements.txt

# 4. Copy the env template (keep defaults for now)
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux

# 5. Start the backend
uvicorn app.main:app --reload

# API live at:       http://127.0.0.1:8000
# Interactive docs:  http://127.0.0.1:8000/docs
```

Run the test suite to verify the backend is healthy before integrating your own module:

```bash
pytest -v
# Expected: 11 passed
```

---

## 👤 Member A — Mobile App / Capture Frontend

You consume the backend's REST API from React Native. You do **not** touch any Python files.

### Endpoints available to you

| Endpoint | Method | What it does |
|---|---|---|
| `/auth/register` | POST | Register a health worker account |
| `/auth/login` | POST | Get a JWT access token |
| `/patients` | POST | Create a patient record |
| `/cases` | POST | Upload an image → triggers quality check + risk model |
| `/cases/{id}` | GET | Fetch full case detail (quality audit + risk score) |
| `/sync` | POST | **Batch offline-first sync** — send queued patients + cases in one call |
| `/check-image-quality` | POST | Run quality check only, no case created (useful for pre-upload preview) |

Full interactive docs: `http://127.0.0.1:8000/docs`

---

### Auth flow

```
POST /auth/register
Body: { "username": "hw1", "password": "pass1234", "role": "health_worker", "full_name": "Priya Singh" }

POST /auth/login
Body (form-data): username=hw1 & password=pass1234
Response: { "access_token": "eyJ..." }

All subsequent calls:
Header: Authorization: Bearer <access_token>
```

---

### Offline-first sync payload

When the device reconnects after being offline, POST to `/sync` with this JSON body:

```json
POST /sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "patients": [
    {
      "client_uuid": "device-generated-uuid-for-patient",
      "name": "Ramesh Kumar",
      "age": 45,
      "sex": "M",
      "phone": "9876543210",
      "village_or_facility": "Rajpur PHC",
      "client_updated_at": "2026-08-10T09:00:00Z"
    }
  ],
  "cases": [
    {
      "client_uuid": "device-generated-uuid-for-case",
      "patient_client_uuid": "device-generated-uuid-for-patient",
      "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB...",
      "captured_at": "2026-08-10T09:01:00Z",
      "device_info": "Pixel 6a / TobaccoShieldApp v0.1",
      "client_updated_at": "2026-08-10T09:01:00Z",

      "device_quality_result": {
        "pass": false,
        "reason": "blur",
        "all_failed_reasons": ["blur"],
        "scores": {
          "blur_score": 12.3,
          "brightness_score": 130,
          "glare_area_pct": 0.1,
          "framing_confidence": 0.8
        },
        "module_version": "on-device-tflite-0.9"
      }
    }
  ]
}
```

> **Note:** `device_quality_result` is **optional**. Include it when Member B's on-device model
> already ran and you want to skip server-side recompute. Leave it out and the server
> runs the quality check automatically.

---

### Sync response — what each `status` means

```json
{
  "patients": [{ "client_uuid": "...", "server_id": "...", "status": "created" }],
  "cases":    [{ "client_uuid": "...", "server_id": "...", "status": "created" }],
  "synced_at": "2026-08-15T12:00:00Z"
}
```

| `status` | Meaning | Your UI action |
|---|---|---|
| `created` | First-time sync, record created ✅ | Store `server_id` locally for future reference |
| `updated` | Re-synced after dropped connection, no duplicate created ✅ | Safe — retry is idempotent |
| `conflict` | A doctor reviewed this case while the device was offline | Show banner: *"This case was reviewed by a doctor — your offline edit was not applied"* |
| `error` | Something failed (e.g. patient not found) | Log it; surface the `detail` field to the user |

---

### What Member B's retake prompt signals look like

After a `/cases` or `/sync` upload, the response includes a `quality_audit` block:

```json
"quality_audit": {
  "passed": false,
  "reason": "blur",
  "all_failed_reasons": ["blur", "bad_framing"],
  "blur_score": 28.4,
  "brightness_score": 118.0,
  "glare_area_pct": 0.9,
  "framing_confidence": 0.32,
  "module_version": "1.0.0"
}
```

- If `passed` is `false`, prompt the user to retake. Use `reason` for the primary message and `all_failed_reasons` for detailed guidance.
- If `all_failed_reasons` has more than one item, show a combined message, e.g. *"Photo is blurry and misframed. Hold steady and centre the inner cheek."*

---

## 👤 Member B — Image Quality & Preprocessing Pipeline

You deliver a **Python package** called `tobaccoshield_quality`. The backend auto-imports it — no backend code changes needed.

### How the backend calls your code

See `app/integrations/quality_client.py`. The relevant import:

```python
from tobaccoshield_quality import check_image_quality, QualityConfig
result = check_image_quality(image_bytes)
```

### Your package must expose

A single public function with this exact signature:

```python
def check_image_quality(image_input, config=None) -> dict:
    """
    image_input: raw bytes | base64 str | file path | BGR numpy array
    config:      optional QualityConfig instance (or None for defaults)
    returns:     dict matching the contract below
    """
```

And optionally a `QualityConfig` dataclass / object for threshold customisation.

### Required return dict — the team contract

```python
{
    "pass": True,                     # bool — True if ALL 4 checks pass
    "reason": None,                   # str | None — FIRST failing check name (priority order)
    "all_failed_reasons": [],         # list[str] — ALL failing check names
    "scores": {
        "blur_score": 142.5,          # Laplacian variance
        "brightness_score": 128.4,    # Mean grayscale luminance (0–255)
        "glare_area_pct": 0.8,        # Specular highlight area %
        "framing_confidence": 0.88,   # Buccal mucosa presence confidence (0–1)
    },
    "timestamp": "2026-08-15T14:58:28Z",   # ISO 8601 UTC string
    "module_version": "1.0.0",
}
```

**Rules that must hold:**

1. `reason` must be one of: `"blur"`, `"underexposed"`, `"overexposed"`, `"glare"`, `"bad_framing"`, or `null`.
2. Priority order for `reason`: blur → underexposed/overexposed → glare → bad_framing.
3. `all_failed_reasons` must contain **all** failing checks, not just the first.
4. `scores` must **always** include all 4 keys, even when the image passes.

### How to plug in your package

```bash
# Put your package folder tobaccoshield_quality/ anywhere, then install:
pip install -e path/to/tobaccoshield_quality/

# Or install from a built wheel:
pip install tobaccoshield_quality-1.0.0-py3-none-any.whl
```

Then in `.env`:

```
USE_REAL_QUALITY_MODULE=true
```

The backend detects your package at startup. If found, it uses it. If not found, it silently falls back to Member D's bundled stub — no crash, no code changes required from either side.

### What NOT to touch

| File | Rule |
|---|---|
| `app/mocks/quality_stub.py` | **Do not edit** — this is the fallback stub used during tests |
| `app/integrations/quality_client.py` | **Do not edit** — this is the auto-switch logic |
| Any test file under `tests/` | **Do not edit** — tests always force stubs off |

### Verify your integration

```bash
# After installing your package:
pytest tests/test_fake_pipeline.py -v
# All 11 tests should still pass

# Run the sample checker against real images:
python test_quality_checker.py sample_images/
```

> **Threshold calibration reminder:** Default thresholds (`BLUR_THRESHOLD=100`, brightness `40–215`)
> were set on synthetic images. Before Member C starts training, collect 15–20 real buccal mucosa
> photos, run the checker, and tune thresholds in `QualityConfig` to match real phone optics.

---

## 👤 Member C — Risk Classification Model

You deliver a **Python package** called `tobaccoshield_risk`. The backend auto-imports it — no backend code changes needed.

### How the backend calls your code

See `app/integrations/risk_client.py`. The relevant import:

```python
from tobaccoshield_risk import classify_risk
result = classify_risk(image_bytes)
```

### Your package must expose

```python
def classify_risk(image_input, config=None) -> dict:
    """
    image_input: raw bytes | base64 str | file path | BGR numpy array
    config:      optional dict of overrides (or None)
    returns:     dict matching the contract below
    """
```

### Required return dict — the team contract

```python
{
    "risk_category": "medium",           # "low" | "medium" | "high" | "cannot_assess"
    "confidence": 0.82,                   # float 0.0–1.0
    "cannot_assess": False,               # True when the image is unassessable
    "cannot_assess_reason": None,         # str | None — reason if cannot_assess is True

    "heatmap_png_bytes": b"...",          # bytes | None — PNG of suspicious-region heatmap
    "model_version": "phase1-v0.1",      # str — your model version tag
    "timestamp": "2026-08-15T14:58:29Z",
}
```

**Rules that must hold:**

1. **Never raise an exception.** If your model cannot run (bad image, internal error), return `"risk_category": "cannot_assess"` and `"cannot_assess": True` with a descriptive `cannot_assess_reason`. The backend has no blanket try/except around your call.
2. `heatmap_png_bytes` can be `None` for Phase 1 if the heatmap overlay isn't ready yet — the backend handles that.
3. The backend only calls `classify_risk()` when `quality_audit.passed == True`. You will never receive a quality-failed image from the backend pipeline.

### Critical: quality-gate your training data too

The backend enforces this at inference time, but you must also enforce it during training:

```python
from tobaccoshield_quality import check_image_quality

def build_training_set(image_paths):
    approved = []
    for path in image_paths:
        with open(path, "rb") as f:
            image_bytes = f.read()
        quality = check_image_quality(image_bytes)
        if quality["pass"]:
            approved.append(path)
        else:
            print(f"Skipped {path}: {quality['all_failed_reasons']}")
    return approved
```

### How to plug in your package

```bash
pip install -e path/to/tobaccoshield_risk/

# Or from a wheel:
pip install tobaccoshield_risk-0.1.0-py3-none-any.whl
```

Then in `.env`:

```
USE_REAL_RISK_MODULE=true
```

### What the doctor dashboard displays from your output

| Your field | Dashboard display |
|---|---|
| `risk_category` | Coloured risk badge — Low (green) / Medium (amber) / High (red) |
| `confidence` | Shown as a percentage next to the badge |
| `heatmap_png_bytes` | Rendered as a semi-transparent overlay on the original image |
| `cannot_assess` | Shown as a warning banner: *"Model could not assess — please retake"* |
| `model_version` | Shown in the case detail footer |

### What NOT to touch

| File | Rule |
|---|---|
| `app/mocks/risk_stub.py` | **Do not edit** — this is the fallback stub used during tests |
| `app/integrations/risk_client.py` | **Do not edit** — this is the auto-switch logic |

### Verify your integration

```bash
pytest tests/test_fake_pipeline.py -v
# All 11 tests should still pass

# Generate sample JPEG images to run inference on:
python generate_test_samples.py
```

---

## 📝 `.env` Quick Reference

```bash
# Database (SQLite is fine for local dev; swap for Postgres in production)
DATABASE_URL=sqlite:///./tobaccoshield.db

# JWT secret — CHANGE before any real deployment
SECRET_KEY=change-this-before-deploying
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Upload directory for images and heatmaps
UPLOAD_DIR=./uploads

# Member B — set true once your package is installed
USE_REAL_QUALITY_MODULE=true

# Member C — set true once your package is installed
USE_REAL_RISK_MODULE=true
```

> When a flag is `true` but the package isn't installed, the backend automatically
> falls back to the stub and logs a warning — it does **not** crash.
> Tests always force both flags to `false` for reproducibility; do not change test files.

---

## ✅ Integration Checklist

| Step | A | B | C |
|---|:---:|:---:|:---:|
| Pull latest repo & `pip install -r requirements.txt` | ✅ | ✅ | ✅ |
| `copy .env.example .env` | ✅ | ✅ | ✅ |
| `uvicorn app.main:app --reload` — confirm it starts | ✅ | ✅ | ✅ |
| `pytest -v` → confirm 11 passed | ✅ | ✅ | ✅ |
| Implement your module package | — | `tobaccoshield_quality` | `tobaccoshield_risk` |
| `pip install -e <your-pkg>/` | — | ✅ | ✅ |
| Set `USE_REAL_QUALITY_MODULE=true` in `.env` | — | ✅ | — |
| Set `USE_REAL_RISK_MODULE=true` in `.env` | — | — | ✅ |
| Re-run `pytest -v` after your module is live | — | ✅ | ✅ |
| Explore `/docs` Swagger UI and test your flows end-to-end | ✅ | ✅ | ✅ |
