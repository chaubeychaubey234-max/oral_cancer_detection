import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user, require_role
from app.config import settings
from app.database import get_db
from app.integrations.quality_client import run_quality_check
from app.integrations.risk_client import run_risk_classification

router = APIRouter(prefix="/cases", tags=["cases"])


def _save_bytes(subdir: str, data: bytes, ext: str = "jpg") -> str:
    fname = f"{uuid.uuid4()}.{ext}"
    path = settings.upload_path / subdir / fname
    path.write_bytes(data)
    return str(path)


def _run_pipeline(db: Session, case: models.Case, image_bytes: bytes) -> models.Case:
    """
    Shared orchestration used by both the direct-upload endpoint and the
    offline sync endpoint: quality-check first (Member B), and only if it
    passes, run risk classification (Member C). This mirrors the priority
    rule in INTEGRATION_GUIDE.md - quality gatekeeps everything downstream.
    """
    qc = run_quality_check(image_bytes)

    audit = models.ImageQualityAudit(
        case_id=case.id,
        passed=qc["pass"],
        reason=qc["reason"],
        all_failed_reasons=qc.get("all_failed_reasons", []),
        blur_score=qc["scores"].get("blur_score"),
        brightness_score=qc["scores"].get("brightness_score"),
        glare_area_pct=qc["scores"].get("glare_area_pct"),
        framing_confidence=qc["scores"].get("framing_confidence"),
        module_version=qc.get("module_version"),
    )
    db.add(audit)

    if not qc["pass"]:
        case.status = models.CaseStatus.QUALITY_FAILED
        db.add(case)
        db.commit()
        db.refresh(case)
        return case

    case.status = models.CaseStatus.QUALITY_PASSED
    db.add(case)
    db.commit()

    risk = run_risk_classification(image_bytes)
    heatmap_path = None
    if risk.get("heatmap_png_bytes"):
        heatmap_path = _save_bytes("heatmaps", risk["heatmap_png_bytes"], ext="png")

    assessment = models.RiskAssessment(
        case_id=case.id,
        risk_category=risk.get("risk_category"),
        confidence=risk.get("confidence"),
        cannot_assess=risk.get("cannot_assess", False),
        cannot_assess_reason=risk.get("cannot_assess_reason"),
        heatmap_path=heatmap_path,
        model_version=risk.get("model_version"),
    )
    db.add(assessment)

    case.status = models.CaseStatus.RISK_ASSESSED
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def _to_case_out(case: models.Case) -> schemas.CaseOut:
    image_url = f"/cases/{case.id}/image" if case.image_path else None
    qa_out = None
    if case.quality_audit:
        qa = case.quality_audit
        qa_out = schemas.QualityAuditOut(
            passed=qa.passed,
            reason=qa.reason,
            all_failed_reasons=qa.all_failed_reasons or [],
            blur_score=qa.blur_score,
            brightness_score=qa.brightness_score,
            glare_area_pct=qa.glare_area_pct,
            framing_confidence=qa.framing_confidence,
            module_version=qa.module_version,
            checked_at=qa.checked_at,
        )
    ra_out = None
    if case.risk_assessment:
        ra = case.risk_assessment
        heatmap_url = f"/cases/{case.id}/heatmap" if ra.heatmap_path else None
        ra_out = schemas.RiskAssessmentOut(
            risk_category=ra.risk_category,
            confidence=ra.confidence,
            cannot_assess=ra.cannot_assess,
            cannot_assess_reason=ra.cannot_assess_reason,
            heatmap_url=heatmap_url,
            model_version=ra.model_version,
            assessed_at=ra.assessed_at,
        )
    reviews_out = [
        schemas.CaseReviewOut(
            id=r.id, doctor_id=r.doctor_id, action=r.action.value if hasattr(r.action, "value") else r.action,
            overridden_risk_category=r.overridden_risk_category, comment_text=r.comment_text,
            reviewed_at=r.reviewed_at,
        )
        for r in sorted(case.reviews, key=lambda x: x.reviewed_at)
    ]
    return schemas.CaseOut(
        id=case.id, client_uuid=case.client_uuid, patient_id=case.patient_id,
        status=case.status.value if hasattr(case.status, "value") else case.status,
        image_url=image_url, captured_at=case.captured_at,
        created_at=case.created_at, updated_at=case.updated_at,
        quality_audit=qa_out, risk_assessment=ra_out, reviews=reviews_out,
    )


# ---------------------------------------------------------------------------
# Ingestion: direct online upload (multipart) from Member A's app
# ---------------------------------------------------------------------------
@router.post("", response_model=schemas.CaseOut)
async def create_case(
    patient_id: str = Form(...),
    file: UploadFile = File(...),
    client_uuid: Optional[str] = Form(None),
    device_info: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "patient not found")

    image_bytes = await file.read()
    image_path = _save_bytes("images", image_bytes, ext="jpg")

    case = models.Case(
        client_uuid=client_uuid,
        patient_id=patient.id,
        health_worker_id=current_user.id,
        image_path=image_path,
        captured_at=datetime.now(timezone.utc),
        device_info=device_info,
        status=models.CaseStatus.CAPTURED,
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    case = _run_pipeline(db, case, image_bytes)
    return _to_case_out(case)


@router.get("/{case_id}/image")
def get_case_image(case_id: str, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case or not case.image_path or not Path(case.image_path).exists():
        raise HTTPException(404, "image not found")
    return FileResponse(case.image_path)


@router.get("/{case_id}/heatmap")
def get_case_heatmap(case_id: str, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case or not case.risk_assessment or not case.risk_assessment.heatmap_path:
        raise HTTPException(404, "heatmap not available for this case")
    return FileResponse(case.risk_assessment.heatmap_path)


# ---------------------------------------------------------------------------
# Dashboard queue (Member D's own consumer: the doctor dashboard)
# ---------------------------------------------------------------------------
@router.get("", response_model=List[schemas.CaseListItem])
def list_cases(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Case)
    if status_filter:
        q = q.filter(models.Case.status == status_filter)
    cases = q.order_by(models.Case.created_at.desc()).all()

    out = []
    for c in cases:
        out.append(schemas.CaseListItem(
            id=c.id,
            patient_id=c.patient_id,
            patient_name=c.patient.name if c.patient else "Unknown",
            status=c.status.value if hasattr(c.status, "value") else c.status,
            risk_category=c.risk_assessment.risk_category if c.risk_assessment else None,
            quality_passed=c.quality_audit.passed if c.quality_audit else None,
            created_at=c.created_at,
        ))
    return out


@router.get("/{case_id}", response_model=schemas.CaseOut)
def get_case(case_id: str, db: Session = Depends(get_db),
             current_user: models.User = Depends(get_current_user)):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "case not found")
    return _to_case_out(case)


@router.post("/{case_id}/review", response_model=schemas.CaseOut)
def review_case(
    case_id: str,
    payload: schemas.CaseReviewCreate,
    db: Session = Depends(get_db),
    doctor: models.User = Depends(require_role("doctor")),
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "case not found")
    if payload.action not in ("accept", "override", "comment"):
        raise HTTPException(400, "action must be accept, override, or comment")
    if payload.action == "override" and not payload.overridden_risk_category:
        raise HTTPException(400, "overridden_risk_category is required when action=override")

    review = models.CaseReview(
        case_id=case.id,
        doctor_id=doctor.id,
        action=models.ReviewAction(payload.action),
        overridden_risk_category=payload.overridden_risk_category,
        comment_text=payload.comment_text,
    )
    db.add(review)

    if payload.action in ("accept", "override"):
        case.status = models.CaseStatus.DOCTOR_REVIEWED
        db.add(case)

    db.commit()
    db.refresh(case)
    return _to_case_out(case)
