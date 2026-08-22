# TobaccoShield — FROZEN Intergration Contract

**Status: FROZEN.** Per the team's Integration Policy ("Freeze interfaces
first — ALL"), this document is the single source of truth for every
input/output boundary between Members A, B, C, and D. If your real
implementation needs to deviate from this, that's a team conversation and a
new version of this file — not a silent change in your package.

Owner: Member D (backend is the hub every other member's output flows
through, so D maintains this doc). 

This supersedes the older `INTEGRATION_GUIDE.md` (kept in the repo for
history) — the main change is section 2: **Member B's contract now includes
the AI-ready processed image**, not just a pass/fail verdict.

---

## 1. The pipeline, end to end

```
Member A (capture)
   │  raw JPEG bytes
   ▼
Member B: position → framing → blur → lighting → glare
          → quality decision → preprocessing → AI-ready image
   │  pass/fail + scores + (if pass) processed image
   ▼
Member C: risk classification on the PROCESSED image only
   │  risk category + confidence + cannot_assess + heatmap
   ▼
Member D: stores everything, drives case status, serves the dashboard
```

**Hard rule, matches the priority order everyone agreed on:** Member C's
model must never run on an image that failed Member B's quality check, and
must never run on the raw capture when Member B produced a processed image.
Member D's backend enforces this in code (`app/routers/cases.py::_run_pipeline`)
— it is not just a convention.

---

## 2. Member B → Member D contract: `check_image_quality()`

```python
check_image_quality(image_bytes: bytes, config: QualityConfig | None = None) -> dict
```

Return shape (JSON-serializable):

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
  "processed_image_bytes": "<bytes, JPEG-encoded, present iff pass=true>",
  "timestamp": "2026-08-15T14:58:28Z",
  "module_version": "1.0.0"
}
```

### Rules
1. **`pass`**: `true` only if all checks pass.
2. **`reason`**: the first failing check, in this fixed priority order —
   `blur` → `underexposed`/`overexposed` → `glare` → `bad_framing`. `null`
   when `pass` is `true`.
3. **`all_failed_reasons`**: every failing check, for Member A's retake UI.
4. **`scores`**: always present, all 4 keys, regardless of pass/fail.
5. **`processed_image_bytes`**: **NEW in this version.** The cropped /
   resized / normalized "AI-ready" image. **Required when `pass=true`**,
   omitted or `null` when `pass=false` (no point preprocessing a rejected
   capture). This is what gets handed to Member C — never the raw upload.
   - Target size: **224×224** JPEG (matches the placeholder in
     `app/mocks/quality_stub.py::AI_READY_SIZE`). If Member C's real model
     needs a different size, update this doc and both mock files together.
6. **`module_version`**: your package's version string, for audit logging.

### What Member D provides in return
Member D's backend never calls `check_image_quality` directly on your
behalf during development — it calls a stub with this exact shape
(`app/mocks/quality_stub.py`) so the rest of the pipeline can be built and
tested before your package exists. The moment `tobaccoshield_quality` is
`pip install`-able and importable, `app/integrations/quality_client.py`
picks it up automatically — zero other code changes.

**Integration checklist for Member B:**
- [ ] Package name: `tobaccoshield_quality`, function: `check_image_quality`,
      config class: `QualityConfig`.
- [ ] Match the return shape above exactly, field names included.
- [ ] `processed_image_bytes` must be raw JPEG bytes (not base64, not a
      PIL Image, not a file path).
- [ ] Test against `app/mocks/quality_stub.py` first — if your real
      package's output shape works everywhere the stub's does, integration
      is a non-event.

---

## 3. Member C → Member D contract: `classify_risk()`

```python
classify_risk(image_bytes: bytes, config: dict | None = None) -> dict
```

Return shape:

```json
{
  "risk_category": "low",
  "confidence": 0.83,
  "cannot_assess": false,
  "cannot_assess_reason": null,
  "heatmap_png_bytes": "<bytes, PNG-encoded, optional>",
  "model_version": "0.3.0",
  "timestamp": "2026-08-15T14:58:29Z"
}
```

### Rules
1. **`risk_category`**: one of `"low"`, `"medium"`, `"high"`, or
   `"cannot_assess"`.
2. **`confidence`**: 0.0–1.0.
3. **`cannot_assess`** / **`cannot_assess_reason`**: set both when the model
   can't confidently classify (this is a real state, not an error — Member D
   stores it and the dashboard shows it distinctly from low/medium/high).
4. **`heatmap_png_bytes`**: optional Grad-CAM / suspicious-region overlay,
   same or near-same dimensions as the input. `null` if not produced.
5. **Input**: always Member B's `processed_image_bytes`, per section 1.
   Do not design/tune your model against raw, unprocessed captures.

**Integration checklist for Member C:**
- [ ] Package name: `tobaccoshield_risk`, function: `classify_risk`.
- [ ] Train/validate/tune only on images that passed Member B's quality
      check (per the team's integration order) — pull them via
      `GET /cases?status_filter=quality_passed` or straight from
      `Case.processed_image_path` if you have DB access.
- [ ] Test against `app/mocks/risk_stub.py` first, same reasoning as B.

---

## 4. Member A ↔ Member D contract (backend API)

Full request/response schemas live in `app/schemas.py` (always the source
of truth if this doc and the code ever disagree — code wins, then fix this
doc). Summary:

| Purpose | Endpoint | Notes |
|---|---|---|
| Register/login | `POST /auth/register`, `POST /auth/login` | JWT bearer token |
| Register a patient (online) | `POST /patients` | needs `client_uuid` for offline-created patients |
| Patient history | `GET /patients/{id}/cases` | for the history list screen |
| Upload one capture (online) | `POST /cases` (multipart) | runs the full B→C pipeline synchronously, returns case incl. quality + risk |
| Batch upload (offline-first) | `POST /sync` | patients + cases in one call, idempotent on `client_uuid`, see conflict rules in `app/routers/sync.py` |
| Case detail (for retake/result UI) | `GET /cases/{id}` | includes `quality_audit.all_failed_reasons` for retake messaging |

**Every case-creating call needs a stable `client_uuid`** generated once
on-device and reused on retry — this is what makes `/sync` idempotent and
safe to call again after a dropped connection.

**Error shape**, same for every endpoint (see `app/error_handling.py`):
```json
{ "error": { "code": "bad_request", "message": "human-readable message", "detail": null } }
```

---

## 5. Changing this contract

Don't. If you must: raise it with the team, bump a version note at the top
of this file, update `app/mocks/quality_stub.py` / `app/mocks/risk_stub.py`
and `app/schemas.py` in the same PR, and re-run `pytest -v` in
`member_d_backend/` before merging. A contract change that isn't reflected
in the stubs isn't actually integrated — it's just a promise.
