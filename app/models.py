"""
Database schema for TobaccoShield Phase 1 backend.

Design notes (per project brief, "designed with future fields in mind"):
- Patient carries placeholder columns for tobacco history / OSMF so Phase 2
  (IoT saliva module, structured tobacco history, OSMF measurement) can be
  added without a migration that touches unrelated tables.
- Case is the central pipeline object: one buccal-mucosa capture, its quality
  audit (Member B), its risk assessment (Member C), and its doctor review
  all hang off Case.id.
- client_uuid columns exist on every table the mobile app creates offline, so
  the sync endpoint can upsert idempotently (device may retry a POST after a
  dropped connection without creating duplicates).
"""
import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _enum_col(enum_cls, **kw):
    """
    SQLAlchemy's Enum() stores the Python member NAME by default (e.g.
    "QUALITY_PASSED"), not its .value ("quality_passed"). Every API response,
    the dashboard, and query filters in this codebase all use the lowercase
    .value strings, so we force storage to match .value - otherwise filtering
    by plain strings (e.g. GET /cases?status_filter=quality_passed) silently
    returns zero rows.
    """
    return Enum(enum_cls, values_callable=lambda cls: [e.value for e in cls], **kw)


class UserRole(str, enum.Enum):
    HEALTH_WORKER = "health_worker"
    DOCTOR = "doctor"
    ADMIN = "admin"


class CaseStatus(str, enum.Enum):
    CAPTURED = "captured"                # image uploaded, not yet quality-checked
    QUALITY_FAILED = "quality_failed"     # Member B rejected it, awaiting retake
    QUALITY_PASSED = "quality_passed"     # passed Member B, awaiting risk model
    RISK_ASSESSED = "risk_assessed"       # Member C has produced a result
    DOCTOR_REVIEWED = "doctor_reviewed"   # a doctor has accepted/overridden/commented


class ReviewAction(str, enum.Enum):
    ACCEPT = "accept"
    OVERRIDE = "override"
    COMMENT = "comment"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(_enum_col(UserRole), nullable=False, default=UserRole.HEALTH_WORKER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    patients = relationship("Patient", back_populates="health_worker")
    reviews = relationship("CaseReview", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=_uuid)
    client_uuid = Column(String, unique=True, index=True, nullable=True)  # id assigned offline by Member A's app

    health_worker_id = Column(String, ForeignKey("users.id"), nullable=True)

    name = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    sex = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    village_or_facility = Column(String, nullable=True)

    # --- Phase 2 placeholder fields (kept nullable so Phase 1 never needs them) ---
    tobacco_type = Column(String, nullable=True)          # khaini/gutkha/zarda/bidi/cigarette
    tobacco_quantity = Column(String, nullable=True)
    tobacco_frequency = Column(String, nullable=True)
    tobacco_duration_years = Column(Float, nullable=True)
    osmf_mouth_opening_mm = Column(Float, nullable=True)  # inter-incisal distance
    saliva_ldh_iu_l = Column(Float, nullable=True)
    saliva_nitrite = Column(Float, nullable=True)
    saliva_ph = Column(Float, nullable=True)
    # -------------------------------------------------------------------------

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    client_updated_at = Column(DateTime, nullable=True)  # last-write-wins clock from the mobile device

    health_worker = relationship("User", back_populates="patients")
    cases = relationship("Case", back_populates="patient", cascade="all, delete-orphan")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=_uuid)
    client_uuid = Column(String, unique=True, index=True, nullable=True)

    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    health_worker_id = Column(String, ForeignKey("users.id"), nullable=True)

    image_path = Column(String, nullable=True)               # raw capture, as uploaded
    processed_image_path = Column(String, nullable=True)     # Member B's AI-ready output (what C actually saw)
    captured_at = Column(DateTime, nullable=True)
    device_info = Column(String, nullable=True)

    status = Column(_enum_col(CaseStatus), default=CaseStatus.CAPTURED, nullable=False)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)
    client_updated_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="cases")
    quality_audit = relationship("ImageQualityAudit", back_populates="case", uselist=False,
                                  cascade="all, delete-orphan")
    risk_assessment = relationship("RiskAssessment", back_populates="case", uselist=False,
                                    cascade="all, delete-orphan")
    reviews = relationship("CaseReview", back_populates="case", cascade="all, delete-orphan")


class ImageQualityAudit(Base):
    """Mirrors the JSON contract published by Member B in INTEGRATION_GUIDE.md."""
    __tablename__ = "image_quality_audits"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), unique=True, nullable=False)

    passed = Column(Boolean, nullable=False)
    reason = Column(String, nullable=True)
    all_failed_reasons = Column(JSON, default=list)

    blur_score = Column(Float, nullable=True)
    brightness_score = Column(Float, nullable=True)
    glare_area_pct = Column(Float, nullable=True)
    framing_confidence = Column(Float, nullable=True)

    module_version = Column(String, nullable=True)
    checked_at = Column(DateTime, default=_now)

    case = relationship("Case", back_populates="quality_audit")


class RiskAssessment(Base):
    """Mirrors the JSON contract expected from Member C (see app/integrations/risk_client.py)."""
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), unique=True, nullable=False)

    risk_category = Column(String, nullable=True)   # low | medium | high | cannot_assess
    confidence = Column(Float, nullable=True)
    cannot_assess = Column(Boolean, default=False)
    cannot_assess_reason = Column(String, nullable=True)

    heatmap_path = Column(String, nullable=True)
    model_version = Column(String, nullable=True)
    assessed_at = Column(DateTime, default=_now)

    case = relationship("Case", back_populates="risk_assessment")


class CaseReview(Base):
    """A doctor's action on a case: accept the AI result, override it, or just comment."""
    __tablename__ = "case_reviews"

    id = Column(String, primary_key=True, default=_uuid)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    doctor_id = Column(String, ForeignKey("users.id"), nullable=False)

    action = Column(_enum_col(ReviewAction), nullable=False)
    overridden_risk_category = Column(String, nullable=True)
    comment_text = Column(Text, nullable=True)

    reviewed_at = Column(DateTime, default=_now)

    case = relationship("Case", back_populates="reviews")
    doctor = relationship("User", back_populates="reviews")
