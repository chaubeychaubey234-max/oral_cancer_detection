# TobaccoShield — Member D: Backend + Doctor Dashboard

This folder is Member D's complete, independently-runnable deliverable for
Phase 1: patient records, case queue, auth, an offline-first sync endpoint,
and a doctor dashboard.

It includes:
- A real implementation of everything Member D owns.
- Drop-in **stubs** that stand in for Member B's quality checker and Member
  C's risk model, following the exact contracts they're expected to publish.
- A pytest suite that fakes "Member A" (capture uploads) and exercises the
  full pipeline end-to-end against those stubs, so you can prove your code
  is correct without anyone else having shipped anything yet.
- A script that seeds a running server with fake data so you can click
  around the actual dashboard.

When Member B and Member C's real packages land in the repo, you flip one
env var each (see `.env.example`) and nothing else in this codebase changes.

---

## 1. Setup

Requires **Python 3.10+** (the code uses `X | None` type hints).

```bash
cd whatever_dir
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

- a clean image passes the quality stub and gets a risk assessment
- a blurred / underexposed / badly-framed image fails quality **and the
  risk model correctly never runs on it** (this is the one rule that must
  never break: quality gatekeeps risk classification)
- a health worker gets a 403 trying to review a case; a doctor doesn't
- accept / override / comment all work and are recorded with an audit trail
- the offline sync endpoint creates patients/cases idempotently, replays
  safely after a dropped connection, and — importantly — refuses to let a
  stale offline resync silently erase a doctor's review (reports `conflict`
  instead)

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
| Member B's quality checker | A bundled stub implementing the *exact* JSON contract from `INTEGRATION_GUIDE.md` §2 | `app/mocks/quality_stub.py` |
| Member C's risk model | A bundled stub implementing a proposed contract (see its docstring) — deterministic per image so tests are reproducible | `app/mocks/risk_stub.py` |

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
- Do the same for Member C once they publish a `tobaccoshield_risk` package
  matching the contract documented in `app/mocks/risk_stub.py`'s docstring
  — hand that docstring to Member C as the proposed interface if they
  haven't settled on one yet.
- Set `USE_REAL_QUALITY_MODULE=false` / `USE_REAL_RISK_MODULE=false` in
  `.env` at any time to force the stubs back on (useful for demos or if a
  teammate's package is mid-refactor and breaking).

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
    main.py              FastAPI app, mounts routers + dashboard static files
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
  requirements.txt
  .env.example
```
