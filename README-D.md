# TobaccoShield — Member D: Backend + Doctor Dashboard + Integration

This folder is Member D's complete, independently-runnable deliverable:
patient records, case queue, auth, an offline-first sync endpoint, AI-result
storage, a doctor dashboard, and centralized error handling — everything in
the current Member D scope:

- Backend/API integration
- Patient/case management
- Authentication
- Image upload/sync
- Offline → online synchronization
- AI result storage
- Doctor dashboard (image + risk + confidence + explanation display)
- Doctor accept/override/comment
- Case status tracking
- Error handling
- End-to-end integration testing

It does **not** wait on Members A, B, or C. Per the team's Integration
Policy ("Freeze interfaces first — ALL"), the exact input/output contract
for every boundary — B→D, C→D, A↔D — is written down once in
**[`INTERFACE_CONTRACT.md`](./INTERFACE_CONTRACT.md)**. Read that file
first; this README is about running and testing the code that implements it.

This repo includes **stubs** standing in for Member B's quality checker and
Member C's risk model, built to that exact frozen contract — including the
fact that **Member B now owns preprocessing**: it doesn't just gate images,
it hands back an AI-ready processed image, and that's what actually reaches
the risk model (never the raw capture). A pytest suite fakes "Member A"
(capture uploads) and exercises the full pipeline end-to-end against those
stubs, so you can prove your code is correct without anyone else having
shipped anything yet.

When Member B and Member C's real packages land in the repo, you flip one
env var each (see `.env.example`) and nothing else in this codebase changes.

---

## 1. Setup

Requires **Python 3.10+** (the code uses `X | None` type hints).

```bash
cd member_d_backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

SQLite is the default — there's nothing else to install or run. Skip to
step 2.

## 2. Run it

```bash
uvicorn app.main:app --reload
```

- API docs (Swagger): http://localhost:8000/docs
- Doctor dashboard: http://localhost:8000/dashboard
- Health check: http://localhost:8000/health — tells you whether it's using
  the real Member B/C packages or the bundled stubs.

## 3. Prove your code is correct (automated)

```bash
pytest -v
```

This is the real answer to "how do I test whether my code is right" — not
manual clicking. `tests/test_fake_pipeline.py` fakes Member A by uploading
synthetic images (`tests/fake_image_utils.py`) and asserts, end to end:

- a clean image passes the quality stub, gets an AI-ready processed image
  (per `INTERFACE_CONTRACT.md` §2), and gets a risk assessment
- a blurred / underexposed / badly-framed image fails quality **and the
  risk model correctly never runs on it, and no processed image is ever
  produced for it** (the one rule that must never break: quality gatekeeps
  everything downstream)
- a health worker gets a 403 trying to review a case; a doctor doesn't
- accept / override / comment all work and are recorded with an audit trail
- the offline sync endpoint creates patients/cases idempotently, replays
  safely after a dropped connection, and — importantly — refuses to let a
  stale offline resync silently erase a doctor's review (reports `conflict`
  instead)
- a corrupt upload comes back as a clean `400` with the standard error
  envelope, not an unhandled `500` — and in `/sync`, a bad image in one
  batch item is reported as a per-item `"error"` without failing the whole
  batch

Run it after every change. If it's green, your Member D code is doing what
the contract says regardless of what A/B/C's real code eventually looks
like.

## 4. Poke at the actual dashboard (manual)

```bash
uvicorn app.main:app --reload          # terminal 1
python3 scripts/seed_fake_data.py      # terminal 2
```

Then open http://localhost:8000/dashboard and log in as
`doctor1` / `doctor12345`. You'll see a queue of fake cases in different
states (passed quality + risk-assessed, quality-failed, etc.) to click
through and review.

---

## How "faking Member A/B/C" works here

| Real component | What stands in for it right now | Where |
|---|---|---|
| Member A's mobile app | `tests/fake_image_utils.py` (synthetic JPEGs) + direct HTTP calls (multipart upload or `/sync` batch) in tests/scripts | `tests/`, `scripts/seed_fake_data.py` |
| Member B's quality checker + preprocessor | A bundled stub implementing the *exact frozen* contract in `INTERFACE_CONTRACT.md` §2 — including producing the AI-ready `processed_image_bytes` | `app/mocks/quality_stub.py` |
| Member C's risk model | A bundled stub implementing the frozen contract in `INTERFACE_CONTRACT.md` §3 — runs on B's processed image, deterministic per image so tests are reproducible | `app/mocks/risk_stub.py` |

Neither stub is meant to be accurate — they exist only so every code path
in Member D's backend (status transitions, retake-style failures, dashboard
badges, heatmap rendering, doctor review) can be exercised without waiting
on anyone else's model.

### Swapping in the real thing later

`app/integrations/quality_client.py` and `app/integrations/risk_client.py`
are the *only* places that decide "real module or stub." Everything else
in the app calls `run_quality_check()` / `run_risk_classification()` and
has no idea which one it's talking to.

- Drop Member B's real `tobaccoshield_quality` package into this repo's
  Python environment (e.g. `pip install -e ../path/to/their/package`, or
  once it exists, add it to `requirements.txt`). It's auto-detected: as
  soon as `import tobaccoshield_quality` succeeds, it's used automatically.
  If their real package doesn't yet return `processed_image_bytes`,
  `quality_client.py` logs a warning and falls back to the raw capture so
  the pipeline degrades gracefully instead of breaking outright — but flag
  that gap to Member B, since it means the contract isn't actually met yet.
- Do the same for Member C once they publish `tobaccoshield_risk` matching
  `INTERFACE_CONTRACT.md` §3.
- Set `USE_REAL_QUALITY_MODULE=false` / `USE_REAL_RISK_MODULE=false` in
  `.env` at any time to force the stubs back on (useful for demos or if a
  teammate's package is mid-refactor and breaking).

---

## Error handling

Every error response, from any endpoint and any cause, shares one envelope
(`app/error_handling.py`):

```json
{ "error": { "code": "bad_request", "message": "uploaded file is not a readable image" } }
```

- Domain-known bad input (corrupt/empty image upload, invalid base64) is
  caught close to the source and returns a clean `400` — never surfaces as
  an unhandled `500`.
- Pydantic validation errors return `422` with field-level `detail`.
- Anything truly unexpected is logged server-side with a request ID
  (`X-Request-ID` response header, also in the error body) and returns a
  generic `500` — the client never sees a raw traceback.
- In `/sync`, a bad item in a batch is reported as a per-item
  `"status": "error"` result; it never fails the whole batch.

---

## What Member D expects from Member A

`POST /cases` (multipart, for online capture) or `POST /sync` (batch JSON,
for offline-first capture) — see `app/schemas.py::SyncCaseItem` for the
exact payload shape. Key point for Member A: every patient and case created
on-device needs a stable `client_uuid` generated once and reused on retries
so sync stays idempotent.

## What Member D provides to Member A / C

- `GET /patients/{id}/cases` — a patient's case history (for the "history
  list placeholder" Member A needs).
- `check_image_quality`/risk results are always echoed back in the case
  response so Member A can show retake prompts using the same
  `all_failed_reasons` logic documented in `INTEGRATION_GUIDE.md` §3.
- Member C can call `GET /cases?status_filter=quality_passed` (or hook into
  the sync/upload pipeline directly) to pull only quality-passed images for
  training, per the coordination note in `INTEGRATION_GUIDE.md` §5.

---

## Project layout

```
member_d_backend/
  app/
    main.py              FastAPI app, mounts routers + dashboard static files, installs error handlers
    error_handling.py      centralized error envelope, logging, request IDs
    config.py             env-based settings
    database.py           SQLAlchemy engine/session
    models.py              User, Patient, Case, ImageQualityAudit, RiskAssessment, CaseReview
    schemas.py             Pydantic request/response contracts
    auth.py                 JWT auth, password hashing, role checks
    routers/
      auth.py                register / login / me
      patients.py             patient CRUD + history
      cases.py                 upload, pipeline orchestration, dashboard queue, doctor review
      sync.py                   offline-first batch sync with conflict handling
    integrations/
      quality_client.py        real-module-or-stub switch for Member B
      risk_client.py            real-module-or-stub switch for Member C
    mocks/
      quality_stub.py           Member B contract stub
      risk_stub.py                Member C contract stub (also documents the proposed contract)
  dashboard/                 plain HTML/CSS/JS doctor dashboard (no build step)
  tests/
    conftest.py               isolated test DB + auth fixtures
    fake_image_utils.py        synthetic image generator (stands in for Member A)
    test_fake_pipeline.py       the end-to-end proof-of-correctness suite
  scripts/
    seed_fake_data.py           populate a running server for manual dashboard testing
  docker-compose.yml           optional Postgres for production-shaped testing
  INTERFACE_CONTRACT.md        FROZEN input/output contract for every A/B/C/D boundary
  requirements.txt
  .env.example
```
