"""
Offline-first sync endpoint.

Member A's app captures patients/cases while offline (no connectivity in
rural PHCs is the expected common case), queues them locally with a
client-generated UUID + client-side timestamp, then calls this single
batch endpoint whenever connectivity returns.

Conflict policy (kept simple on purpose for Phase 1):
- Each Patient/Case row carries a `client_uuid` (assigned on-device, stable
  across retries) and a `client_updated_at` clock.
- On sync, if no row with that client_uuid exists yet -> create it.
- If a row exists -> last-write-wins on client_updated_at, UNLESS the
  server-side row has already progressed past a point the offline client
  doesn't know about (e.g. a doctor has already reviewed the case) - in
  that case we do NOT let a stale offline edit silently overwrite it; we
  report "conflict" and keep the server version, so Member A's UI can
  surface it instead of quietly losing a doctor's review.
- Every response item is idempotency-safe: re-POSTing the same batch after
  a dropped connection will not create duplicates, it will just report
  "updated" or "conflict" again for the same client_uuid.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db
from app.routers.cases import _run_pipeline, _save_bytes
from app.utils import decode_image_base64, as_naive_utc, validate_image_bytes

router = APIRouter(prefix="/sync", tags=["sync"])


def _upsert_patient(db: Session, item: schemas.SyncPatientItem, health_worker_id: str) -> schemas.SyncResultItem:
    existing = None
    if item.client_uuid:
        existing = db.query(models.Patient).filter(models.Patient.client_uuid == item.client_uuid).first()

    if existing is None:
        patient = models.Patient(
            client_uuid=item.client_uuid,
            health_worker_id=health_worker_id,
            name=item.name, age=item.age, sex=item.sex, phone=item.phone,
            village_or_facility=item.village_or_facility,
            tobacco_type=item.tobacco_type, tobacco_quantity=item.tobacco_quantity,
            tobacco_frequency=item.tobacco_frequency, tobacco_duration_years=item.tobacco_duration_years,
            client_updated_at=item.client_updated_at,
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return schemas.SyncResultItem(client_uuid=item.client_uuid or patient.id, server_id=patient.id, status="created")

    # last-write-wins by client clock; patients have no "server has progressed" lock, unlike cases
    incoming_ts = as_naive_utc(item.client_updated_at)
    existing_ts = as_naive_utc(existing.client_updated_at)
    if incoming_ts and (not existing_ts or incoming_ts >= existing_ts):
        existing.name = item.name
        existing.age = item.age
        existing.sex = item.sex
        existing.phone = item.phone
        existing.village_or_facility = item.village_or_facility
        existing.tobacco_type = item.tobacco_type
        existing.tobacco_quantity = item.tobacco_quantity
        existing.tobacco_frequency = item.tobacco_frequency
        existing.tobacco_duration_years = item.tobacco_duration_years
        existing.client_updated_at = item.client_updated_at
        db.add(existing)
        db.commit()
        return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id=existing.id, status="updated")

    return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id=existing.id, status="conflict",
                                   detail="server copy is newer or equal; offline edit discarded")


def _upsert_case(db: Session, item: schemas.SyncCaseItem, health_worker_id: str) -> schemas.SyncResultItem:
    existing = db.query(models.Case).filter(models.Case.client_uuid == item.client_uuid).first()
    if existing is not None:
        # Case already synced once. If a doctor has since reviewed it server-side,
        # never let a re-queued offline case silently regress its status.
        if existing.status == models.CaseStatus.DOCTOR_REVIEWED:
            return schemas.SyncResultItem(
                client_uuid=item.client_uuid, server_id=existing.id, status="conflict",
                detail="case already reviewed by a doctor server-side; offline resubmission ignored",
            )
        return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id=existing.id, status="updated",
                                       detail="case already synced; no change")

    patient = db.query(models.Patient).filter(models.Patient.client_uuid == item.patient_client_uuid).first()
    if patient is None:
        return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id="", status="error",
                                       detail=f"unknown patient_client_uuid {item.patient_client_uuid}; sync patients first")

    try:
        image_bytes = decode_image_base64(item.image_base64)
        validate_image_bytes(image_bytes)
    except HTTPException as e:
        return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id="", status="error",
                                       detail=str(e.detail))
    except Exception as e:
        return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id="", status="error",
                                       detail=f"could not decode image_base64: {e}")

    image_path = _save_bytes("images", image_bytes, ext="jpg")

    case = models.Case(
        client_uuid=item.client_uuid,
        patient_id=patient.id,
        health_worker_id=health_worker_id,
        image_path=image_path,
        captured_at=item.captured_at or datetime.now(timezone.utc),
        device_info=item.device_info,
        client_updated_at=item.client_updated_at,
        status=models.CaseStatus.CAPTURED,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    # If the device already ran Member B's on-device quality model, trust it
    # (saves re-running the check server-side); otherwise run the full pipeline.
    if item.device_quality_result:
        qc = item.device_quality_result
        audit = models.ImageQualityAudit(
            case_id=case.id,
            passed=qc.get("pass", False),
            reason=qc.get("reason"),
            all_failed_reasons=qc.get("all_failed_reasons", []),
            blur_score=qc.get("scores", {}).get("blur_score"),
            brightness_score=qc.get("scores", {}).get("brightness_score"),
            glare_area_pct=qc.get("scores", {}).get("glare_area_pct"),
            framing_confidence=qc.get("scores", {}).get("framing_confidence"),
            module_version=qc.get("module_version", "on-device"),
        )
        db.add(audit)
        if qc.get("pass"):
            case.status = models.CaseStatus.QUALITY_PASSED
            db.add(case)
            db.commit()
            from app.integrations.risk_client import run_risk_classification
            # Per INTERFACE_CONTRACT.md, C should run on B's AI-ready image, not the
            # raw capture. If the on-device quality model included one (base64,
            # matching the same field the server-side stub/real module produces),
            # use it; otherwise fall back to the raw capture and log why.
            processed_bytes = image_bytes
            if qc.get("processed_image_base64"):
                processed_bytes = decode_image_base64(qc["processed_image_base64"])
                case.processed_image_path = _save_bytes("images", processed_bytes, ext="jpg")
                db.add(case)
                db.commit()
            risk = run_risk_classification(processed_bytes)
            heatmap_path = _save_bytes("heatmaps", risk["heatmap_png_bytes"], ext="png") if risk.get("heatmap_png_bytes") else None
            db.add(models.RiskAssessment(
                case_id=case.id, risk_category=risk.get("risk_category"), confidence=risk.get("confidence"),
                cannot_assess=risk.get("cannot_assess", False), cannot_assess_reason=risk.get("cannot_assess_reason"),
                heatmap_path=heatmap_path, model_version=risk.get("model_version"),
            ))
            case.status = models.CaseStatus.RISK_ASSESSED
        else:
            case.status = models.CaseStatus.QUALITY_FAILED
        db.add(case)
        db.commit()
    else:
        case = _run_pipeline(db, case, image_bytes)

    return schemas.SyncResultItem(client_uuid=item.client_uuid, server_id=case.id, status="created")


@router.post("", response_model=schemas.SyncResponse)
def sync_batch(
    payload: schemas.SyncRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient_results = [_upsert_patient(db, p, current_user.id) for p in payload.patients]
    case_results = [_upsert_case(db, c, current_user.id) for c in payload.cases]
    return schemas.SyncResponse(
        patients=patient_results, cases=case_results,
        synced_at=datetime.now(timezone.utc),
    )
