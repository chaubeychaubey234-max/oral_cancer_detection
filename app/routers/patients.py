from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=schemas.PatientOut)
def create_patient(
    payload: schemas.PatientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Used by Member A's app for a single online registration (see /sync for offline batches)."""
    if payload.client_uuid:
        existing = db.query(models.Patient).filter(models.Patient.client_uuid == payload.client_uuid).first()
        if existing:
            raise HTTPException(409, "patient with this client_uuid already exists")

    patient = models.Patient(
        client_uuid=payload.client_uuid,
        health_worker_id=current_user.id,
        name=payload.name,
        age=payload.age,
        sex=payload.sex,
        phone=payload.phone,
        village_or_facility=payload.village_or_facility,
        tobacco_type=payload.tobacco_type,
        tobacco_quantity=payload.tobacco_quantity,
        tobacco_frequency=payload.tobacco_frequency,
        tobacco_duration_years=payload.tobacco_duration_years,
        client_updated_at=payload.client_updated_at,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("", response_model=List[schemas.PatientOut])
def list_patients(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    q = db.query(models.Patient)
    if current_user.role == models.UserRole.HEALTH_WORKER:
        q = q.filter(models.Patient.health_worker_id == current_user.id)
    return q.order_by(models.Patient.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{patient_id}", response_model=schemas.PatientOut)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "patient not found")
    return patient


@router.get("/{patient_id}/cases", response_model=List[schemas.CaseListItem])
def get_patient_cases(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Longitudinal history list placeholder for Member A / dashboard timeline views."""
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "patient not found")

    items = []
    for c in sorted(patient.cases, key=lambda x: x.created_at, reverse=True):
        items.append(schemas.CaseListItem(
            id=c.id,
            patient_id=patient.id,
            patient_name=patient.name,
            status=c.status.value if hasattr(c.status, "value") else c.status,
            risk_category=c.risk_assessment.risk_category if c.risk_assessment else None,
            quality_passed=c.quality_audit.passed if c.quality_audit else None,
            created_at=c.created_at,
        ))
    return items
