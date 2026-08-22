"""
End-to-end tests for Member D's backend, using fake data standing in for
Member A (capture uploads), Member B (quality check - via the bundled stub),
and Member C (risk classification - via the bundled stub).

Run with:  pytest -v
(conftest.py forces USE_REAL_QUALITY_MODULE / USE_REAL_RISK_MODULE off so
these results are reproducible regardless of what's installed in your venv.)
"""
import base64

from tests.conftest import auth_headers
from tests.fake_image_utils import (
    good_mucosa_image_bytes, blurry_mucosa_image_bytes,
    dark_mucosa_image_bytes, bad_framing_image_bytes,
)


def create_patient(client, token, name="Fake Patient"):
    res = client.post("/patients", json={"name": name, "age": 41, "sex": "M"},
                       headers=auth_headers(token))
    assert res.status_code == 200, res.text
    return res.json()["id"]


def upload_case(client, token, patient_id, image_bytes, client_uuid=None):
    files = {"file": ("capture.jpg", image_bytes, "image/jpeg")}
    data = {"patient_id": patient_id}
    if client_uuid:
        data["client_uuid"] = client_uuid
    res = client.post("/cases", data=data, files=files, headers=auth_headers(token))
    assert res.status_code == 200, res.text
    return res.json()


# ---------------------------------------------------------------------------
def test_health_endpoint_reports_stub_mode(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert "stub" in body["quality_module"]
    assert "stub" in body["risk_module"]


def test_good_image_passes_quality_and_gets_risk_assessed(client, health_worker_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, good_mucosa_image_bytes())

    assert case["status"] == "risk_assessed"
    assert case["quality_audit"]["passed"] is True
    assert case["quality_audit"]["reason"] is None
    assert case["risk_assessment"] is not None
    assert case["risk_assessment"]["risk_category"] in ("low", "medium", "high", "cannot_assess")

    # NEW: quality-passed images must produce an AI-ready processed image,
    # and it must be a DIFFERENT artifact from the raw capture (per
    # INTERFACE_CONTRACT.md section 2 - Member B owns preprocessing now).
    assert case["processed_image_url"] is not None
    processed_res = client.get(case["processed_image_url"], headers=auth_headers(health_worker_token))
    assert processed_res.status_code == 200
    assert processed_res.headers["content-type"].startswith("image/")

    # image + (maybe) heatmap should be fetchable
    img_res = client.get(case["image_url"], headers=auth_headers(health_worker_token))
    assert img_res.status_code == 200
    assert img_res.headers["content-type"].startswith("image/")


def test_blurry_image_fails_quality_and_skips_risk_model(client, health_worker_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, blurry_mucosa_image_bytes())

    assert case["status"] == "quality_failed"
    assert case["quality_audit"]["passed"] is False
    assert case["quality_audit"]["reason"] == "blur"
    assert case["risk_assessment"] is None  # risk model must NOT run on quality-failed images
    assert case["processed_image_url"] is None  # no AI-ready image should exist for a rejected capture


def test_dark_image_fails_as_underexposed(client, health_worker_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, dark_mucosa_image_bytes())
    assert case["quality_audit"]["passed"] is False
    assert "underexposed" in case["quality_audit"]["all_failed_reasons"]


def test_bad_framing_image_fails_framing(client, health_worker_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, bad_framing_image_bytes())
    assert case["quality_audit"]["passed"] is False
    assert "bad_framing" in case["quality_audit"]["all_failed_reasons"]


def test_health_worker_cannot_review_cases(client, health_worker_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, good_mucosa_image_bytes())
    res = client.post(f"/cases/{case['id']}/review", json={"action": "accept"},
                       headers=auth_headers(health_worker_token))
    assert res.status_code == 403


def test_doctor_can_accept_and_override(client, health_worker_token, doctor_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, good_mucosa_image_bytes())

    # doctor sees it in the queue
    queue = client.get("/cases", headers=auth_headers(doctor_token)).json()
    assert any(c["id"] == case["id"] for c in queue)

    # accept
    res = client.post(f"/cases/{case['id']}/review", json={"action": "accept"},
                       headers=auth_headers(doctor_token))
    assert res.status_code == 200
    assert res.json()["status"] == "doctor_reviewed"
    assert len(res.json()["reviews"]) == 1

    # override on a second case
    case2 = upload_case(client, health_worker_token, patient_id, good_mucosa_image_bytes())
    res2 = client.post(f"/cases/{case2['id']}/review",
                        json={"action": "override", "overridden_risk_category": "high",
                              "comment_text": "Visible leukoplakia, model missed it"},
                        headers=auth_headers(doctor_token))
    assert res2.status_code == 200
    review = res2.json()["reviews"][0]
    assert review["action"] == "override"
    assert review["overridden_risk_category"] == "high"


def test_override_requires_category(client, health_worker_token, doctor_token):
    patient_id = create_patient(client, health_worker_token)
    case = upload_case(client, health_worker_token, patient_id, good_mucosa_image_bytes())
    res = client.post(f"/cases/{case['id']}/review", json={"action": "override"},
                       headers=auth_headers(doctor_token))
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Offline-first sync (simulating Member A's queued-while-offline app)
# ---------------------------------------------------------------------------
def test_sync_creates_patient_and_case_then_flags_conflict_after_review(client, health_worker_token, doctor_token):
    img_b64 = base64.b64encode(good_mucosa_image_bytes()).decode()

    sync_payload = {
        "patients": [{
            "client_uuid": "device-patient-001",
            "name": "Offline Registered Patient",
            "age": 55, "sex": "F",
            "client_updated_at": "2026-08-10T09:00:00Z",
        }],
        "cases": [{
            "client_uuid": "device-case-001",
            "patient_client_uuid": "device-patient-001",
            "image_base64": f"data:image/jpeg;base64,{img_b64}",
            "captured_at": "2026-08-10T09:01:00Z",
            "device_info": "Pixel 6a / TobaccoShieldApp v0.1",
            "client_updated_at": "2026-08-10T09:01:00Z",
        }],
    }
    res = client.post("/sync", json=sync_payload, headers=auth_headers(health_worker_token))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["patients"][0]["status"] == "created"
    assert body["cases"][0]["status"] == "created"
    case_server_id = body["cases"][0]["server_id"]

    # verify the pipeline actually ran during sync
    case = client.get(f"/cases/{case_server_id}", headers=auth_headers(health_worker_token)).json()
    assert case["status"] == "risk_assessed"

    # idempotent retry: re-posting the exact same batch (simulating a dropped
    # connection retry) must not create a duplicate case
    res2 = client.post("/sync", json=sync_payload, headers=auth_headers(health_worker_token))
    assert res2.json()["cases"][0]["status"] == "updated"

    # doctor reviews it
    client.post(f"/cases/{case_server_id}/review", json={"action": "accept"},
                headers=auth_headers(doctor_token))

    # device (which doesn't know about the review yet) re-syncs the same
    # case again -> must be reported as a conflict, not silently reset
    res3 = client.post("/sync", json=sync_payload, headers=auth_headers(health_worker_token))
    assert res3.json()["cases"][0]["status"] == "conflict"


def test_sync_case_with_unknown_patient_reports_error(client, health_worker_token):
    img_b64 = base64.b64encode(good_mucosa_image_bytes()).decode()
    payload = {
        "patients": [],
        "cases": [{
            "client_uuid": "orphan-case-001",
            "patient_client_uuid": "does-not-exist",
            "image_base64": img_b64,
        }],
    }
    res = client.post("/sync", json=payload, headers=auth_headers(health_worker_token))
    assert res.status_code == 200
    assert res.json()["cases"][0]["status"] == "error"


def test_sync_with_precomputed_device_quality_result_skips_server_recompute(client, health_worker_token):
    """Simulates Member B's on-device model already having rejected a photo -
    the phone should be able to report that without re-uploading for server recompute logic."""
    img_b64 = base64.b64encode(blurry_mucosa_image_bytes()).decode()
    payload = {
        "patients": [{"client_uuid": "device-patient-002", "name": "Second Offline Patient"}],
        "cases": [{
            "client_uuid": "device-case-002",
            "patient_client_uuid": "device-patient-002",
            "image_base64": img_b64,
            "device_quality_result": {
                "pass": False,
                "reason": "blur",
                "all_failed_reasons": ["blur"],
                "scores": {"blur_score": 12.3, "brightness_score": 130, "glare_area_pct": 0.1, "framing_confidence": 0.8},
                "module_version": "on-device-tflite-0.9",
            },
        }],
    }
    res = client.post("/sync", json=payload, headers=auth_headers(health_worker_token))
    server_id = res.json()["cases"][0]["server_id"]
    case = client.get(f"/cases/{server_id}", headers=auth_headers(health_worker_token)).json()
    assert case["status"] == "quality_failed"
    assert case["quality_audit"]["module_version"] == "on-device-tflite-0.9"
    assert case["risk_assessment"] is None


# ---------------------------------------------------------------------------
# Error handling (app/error_handling.py) - every error response, from any
# cause, must share one JSON envelope: {"error": {"code", "message", ...}}
# ---------------------------------------------------------------------------
def test_corrupt_upload_returns_clean_400_not_500(client, health_worker_token):
    patient_id = create_patient(client, health_worker_token)
    files = {"file": ("not_an_image.jpg", b"this is definitely not JPEG bytes", "image/jpeg")}
    res = client.post("/cases", data={"patient_id": patient_id}, files=files,
                       headers=auth_headers(health_worker_token))
    assert res.status_code == 400
    body = res.json()
    assert body["error"]["code"] == "bad_request"
    assert "image" in body["error"]["message"].lower()


def test_not_found_uses_standard_error_envelope(client, health_worker_token):
    res = client.get("/cases/does-not-exist", headers=auth_headers(health_worker_token))
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_validation_error_uses_standard_error_envelope(client, health_worker_token):
    # missing required "name" field
    res = client.post("/patients", json={"age": 40}, headers=auth_headers(health_worker_token))
    assert res.status_code == 422
    body = res.json()
    assert body["error"]["code"] == "validation_error"
    assert isinstance(body["error"]["detail"], list)


def test_sync_rejects_corrupt_image_as_per_item_error_not_batch_failure(client, health_worker_token):
    payload = {
        "patients": [{"client_uuid": "device-patient-003", "name": "Third Offline Patient"}],
        "cases": [{
            "client_uuid": "device-case-003",
            "patient_client_uuid": "device-patient-003",
            "image_base64": base64.b64encode(b"not a real image").decode(),
        }],
    }
    res = client.post("/sync", json=payload, headers=auth_headers(health_worker_token))
    assert res.status_code == 200  # the BATCH still succeeds
    assert res.json()["cases"][0]["status"] == "error"  # the individual item is reported as failed
