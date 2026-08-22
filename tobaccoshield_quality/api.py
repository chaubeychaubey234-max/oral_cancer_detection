"""
FastAPI Application Wrapping TobaccoShield Image Quality Inspection (Member B).
Exposes REST endpoints for Member A (Mobile App) and Member D (Backend Service).
Supports both multipart/form-data image uploads and Base64 JSON payloads.
"""

from typing import Any, Dict, List, Optional
from fastapi import Body, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import QualityConfig
from .core import MODULE_VERSION, check_image_quality

app = FastAPI(
    title="TobaccoShield Image Quality & Preprocessing API",
    description=(
        "Microservice module for TobaccoShield buccal mucosa photo quality inspection & preprocessing. "
        "Validates positioning, framing, buccal mucosa, distance, blur, lighting, and glare "
        "prior to AI risk classification by Member C."
    ),
    version=MODULE_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Base64ImageRequest(BaseModel):
    """Payload schema for base64 encoded image uploads."""
    image_base64: str = Field(
        ...,
        description="Base64 encoded string of buccal mucosa image",
        json_schema_extra={"example": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD..."},
    )


class QualityChecksMap(BaseModel):
    positioning: str = Field(..., description="'pass' or 'fail'")
    framing: str = Field(..., description="'pass' or 'fail'")
    buccal_mucosa: str = Field(..., description="'pass' or 'fail'")
    distance_coverage: str = Field(..., description="'pass' or 'fail'")
    blur: str = Field(..., description="'pass' or 'fail'")
    lighting: str = Field(..., description="'pass' or 'fail'")
    glare: str = Field(..., description="'pass' or 'fail'")


class QualityScores(BaseModel):
    blur_score: float = Field(..., description="Laplacian variance score.")
    brightness_score: float = Field(..., description="Average luminance intensity (0-255).")
    glare_area_pct: float = Field(..., description="Percentage of frame affected by glare (0-100%).")
    framing_confidence: float = Field(..., description="Mucosa tissue framing probability score (0.0 to 1.0).")
    positioning_score: Optional[float] = Field(None, description="Oral centroid centring score (0.0 to 1.0).")
    mucosa_ratio: Optional[float] = Field(None, description="Mucosa tissue coverage ratio.")
    coverage_ratio: Optional[float] = Field(None, description="Total mucosal area ratio.")
    lighting_unevenness: Optional[float] = Field(None, description="Luminance std-dev in oral ROI.")


class QualityCheckResponse(BaseModel):
    """Exact team contract & Member B response format."""
    passed: bool = Field(..., description="True if image passes all 7 quality checks.")
    pass_flag: bool = Field(..., alias="pass", description="Legacy alias for 'passed'.")
    quality_score: float = Field(..., description="Overall image quality score (0.00 to 1.00). IMAGE QUALITY ONLY.")
    reason: Optional[str] = Field(
        None,
        description="Primary machine-readable failure reason code (null on pass).",
    )
    human_reason: Optional[str] = Field(
        None,
        description="Human-readable guidance/retake instruction for user.",
    )
    all_failed_reasons: List[str] = Field(
        default_factory=list,
        description="List of all failed check codes.",
    )
    checks: QualityChecksMap = Field(..., description="Per-check pass/fail status for all 7 checks.")
    scores: QualityScores = Field(..., description="Numeric metrics for all quality checks.")
    ai_ready_image: Optional[str] = Field(
        None,
        description="Base64 encoded JPEG string of cropped, resized, enhanced image (null on fail).",
    )
    preprocessed_image_b64: Optional[str] = Field(
        None,
        description="Legacy alias for ai_ready_image.",
    )
    timestamp: str = Field(..., description="ISO8601 UTC timestamp.")
    module_version: str = Field(..., description="Module version.")

    class Config:
        populate_by_name = True


@app.get("/health", tags=["System"])
def get_health() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "tobaccoshield-quality-preprocessor",
        "module_version": MODULE_VERSION,
    }


@app.get("/contract", tags=["Documentation"])
def get_contract_spec() -> Dict[str, Any]:
    """Returns technical integration contract spec."""
    cfg = QualityConfig()
    return {
        "module_name": "TobaccoShield Image Quality & Preprocessing (Member B)",
        "entry_function": "tobaccoshield_quality.check_image_quality",
        "pipeline_alias": "tobaccoshield_quality.run_quality_pipeline",
        "api_endpoint": "POST /check-image-quality",
        "checks": [
            "1. Positioning Check        → bad_positioning",
            "2. Framing Check            → bad_framing",
            "3. Buccal Mucosa Check      → no_mucosa",
            "4. Distance/Coverage Check  → too_far | too_close",
            "5. Blur Detection           → blur",
            "6. Lighting/Exposure Check  → underexposed | overexposed | uneven_lighting",
            "7. Glare Check              → glare",
        ],
        "post_processing_order": [
            "1. Crop to oral region bbox (+8% padding)",
            "2. Resize to model input size (224x224)",
            "3. Enhance (CLAHE on L-channel + bilateral filter)",
            "4. Pixel Normalization (0-1 float32)",
            "5. Base64 JPEG Encoding for transport",
        ],
        "rejection_reasons": [
            "bad_positioning", "bad_framing", "no_mucosa", "too_far",
            "too_close", "blur", "underexposed", "overexposed", "uneven_lighting", "glare", "low_quality"
        ],
        "default_thresholds": {
            "blur_threshold": cfg.blur_threshold,
            "brightness_min": cfg.brightness_min,
            "brightness_max": cfg.brightness_max,
            "lighting_unevenness_max": cfg.lighting_unevenness_max,
            "max_glare_area_pct": cfg.max_glare_area_pct,
            "min_framing_confidence": cfg.min_framing_confidence,
            "min_positioning_score": cfg.min_positioning_score,
            "min_buccal_mucosa_ratio": cfg.min_buccal_mucosa_ratio,
            "min_coverage_ratio": cfg.min_coverage_ratio,
            "max_coverage_ratio": cfg.max_coverage_ratio,
            "min_quality_score": cfg.min_quality_score,
        },
    }


@app.post(
    "/check-image-quality",
    response_model=QualityCheckResponse,
    status_code=status.HTTP_200_OK,
    tags=["Quality Assessment"],
    summary="Inspect buccal mucosa image quality & preprocess for AI",
)
async def check_image_quality_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None, description="Multipart binary image file upload"),
    body: Optional[Base64ImageRequest] = Body(None),
) -> Dict[str, Any]:
    image_input: Optional[Any] = None
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            json_payload = await request.json()
            if isinstance(json_payload, dict) and "image_base64" in json_payload:
                image_input = json_payload["image_base64"]
        except Exception:
            pass

    if image_input is None and file is not None and file.filename:
        try:
            image_input = await file.read()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read uploaded file stream: {str(e)}",
            )

    if image_input is None and body is not None and body.image_base64:
        image_input = body.image_base64

    if image_input is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request must contain either a multipart binary file upload OR a JSON body with 'image_base64'.",
        )

    try:
        result = check_image_quality(image_input)
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image preprocessing error: {str(ve)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected internal error during quality inspection: {str(e)}",
        )
