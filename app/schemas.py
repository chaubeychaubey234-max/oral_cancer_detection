from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "health_worker"  # health_worker | doctor | admin


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------------------
# Patients  (created by Member A's mobile app, offline-first)
# ---------------------------------------------------------------------------
class PatientCreate(BaseModel):
    client_uuid: Optional[str] = None
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    phone: Optional[str] = None
    village_or_facility: Optional[str] = None
    client_updated_at: Optional[datetime] = None

    # Phase 2 placeholders - optional, accepted now so the app schema doesn't churn later
    tobacco_type: Optional[str] = None
    tobacco_quantity: Optional[str] = None
    tobacco_frequency: Optional[str] = None
    tobacco_duration_years: Optional[float] = None


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    client_uuid: Optional[str] = None
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    phone: Optional[str] = None
    village_or_facility: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Quality audit (Member B's contract, echoed back verbatim in Case detail)
# ---------------------------------------------------------------------------
class QualityAuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    passed: bool
    reason: Optional[str] = None
    all_failed_reasons: List[str] = []
    blur_score: Optional[float] = None
    brightness_score: Optional[float] = None
    glare_area_pct: Optional[float] = None
    framing_confidence: Optional[float] = None
    module_version: Optional[str] = None
    checked_at: datetime


# ---------------------------------------------------------------------------
# Risk assessment (Member C's contract)
# ---------------------------------------------------------------------------
class RiskAssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    risk_category: Optional[str] = None
    confidence: Optional[float] = None
    cannot_assess: bool = False
    cannot_assess_reason: Optional[str] = None
    heatmap_url: Optional[str] = None
    model_version: Optional[str] = None
    assessed_at: datetime


# ---------------------------------------------------------------------------
# Case review (doctor actions)
# ---------------------------------------------------------------------------
class CaseReviewCreate(BaseModel):
    action: str  # accept | override | comment
    overridden_risk_category: Optional[str] = None
    comment_text: Optional[str] = None


class CaseReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    doctor_id: str
    action: str
    overridden_risk_category: Optional[str] = None
    comment_text: Optional[str] = None
    reviewed_at: datetime


# ---------------------------------------------------------------------------
# Case (the pipeline object)
# ---------------------------------------------------------------------------
class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    client_uuid: Optional[str] = None
    patient_id: str
    status: str
    image_url: Optional[str] = None
    captured_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    quality_audit: Optional[QualityAuditOut] = None
    risk_assessment: Optional[RiskAssessmentOut] = None
    reviews: List[CaseReviewOut] = []


class CaseListItem(BaseModel):
    """Lightweight row for the dashboard case queue table."""
    id: str
    patient_id: str
    patient_name: str
    status: str
    risk_category: Optional[str] = None
    quality_passed: Optional[bool] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Sync payloads (offline-first upload from Member A's app)
# ---------------------------------------------------------------------------
class SyncPatientItem(PatientCreate):
    pass


class SyncCaseItem(BaseModel):
    client_uuid: str
    patient_client_uuid: str
    image_base64: str  # data URI or raw base64 JPEG
    captured_at: Optional[datetime] = None
    device_info: Optional[str] = None
    client_updated_at: Optional[datetime] = None
    # Optional: on-device quality check already run by Member B's on-device model.
    # If present we trust it and skip server-side recompute; else server runs it.
    device_quality_result: Optional[dict] = None


class SyncRequest(BaseModel):
    patients: List[SyncPatientItem] = []
    cases: List[SyncCaseItem] = []


class SyncResultItem(BaseModel):
    client_uuid: str
    server_id: str
    status: str  # created | updated | conflict | error
    detail: Optional[str] = None


class SyncResponse(BaseModel):
    patients: List[SyncResultItem]
    cases: List[SyncResultItem]
    synced_at: datetime