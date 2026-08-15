"""
FastAPI Application Wrapping TobaccoShield Image Quality Inspection.
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
    title="TobaccoShield Image Quality API",
    description=(
        "Microservice module for TobaccoShield buccal mucosa photo quality inspection. "
        "Validates sharpness, exposure, glare, and oral mucosa framing prior to AI risk classification."
    ),
    version=MODULE_VERSION,
)

# Enable CORS for local React web doctor dashboard (Member D) and mobile app testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Base64ImageRequest(BaseModel):
    """Payload schema for base64 encoded image uploads from React Native mobile app."""
    image_base64: str = Field(
        ...,
        description="Base64 encoded string of buccal mucosa image (with or without 'data:image/...;base64,' header)",
        example="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...",
    )


class QualityScores(BaseModel):
    blur_score: float = Field(..., description="Laplacian variance score. Higher is sharper.")
    brightness_score: float = Field(..., description="Average luminance intensity (0-255).")
    glare_area_pct: float = Field(..., description="Percentage of frame affected by flash reflections (0-100%).")
    framing_confidence: float = Field(..., description="Mucosa tissue framing probability score (0.0 to 1.0).")


class QualityCheckResponse(BaseModel):
    """Exact team contract response format."""
    pass_flag: bool = Field(..., alias="pass", description="True if image passes all 4 quality checks.")
    reason: Optional[str] = Field(
        None,
        description="First failing check reason ('blur', 'underexposed', 'overexposed', 'glare', 'bad_framing', or null on pass)",
    )
    all_failed_reasons: List[str] = Field(
        default_factory=list,
        description="List of all checks that failed (e.g. ['blur', 'bad_framing'])",
    )
    scores: QualityScores = Field(..., description="Complete metrics for all 4 quality checks.")
    timestamp: str = Field(..., description="ISO8601 UTC timestamp of inspection.")
    module_version: str = Field(..., description="Module release version.")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "pass": True,
                "reason": None,
                "all_failed_reasons": [],
                "scores": {
                    "blur_score": 145.2,
                    "brightness_score": 128.0,
                    "glare_area_pct": 1.2,
                    "framing_confidence": 0.85,
                },
                "timestamp": "2026-08-15T14:58:28Z",
                "module_version": "1.0.0",
            }
        }


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
    """Returns the technical integration contract spec for Members A, C, and D."""
    return {
        "module_name": "TobaccoShield Image Quality & Preprocessing",
        "entry_function": "tobaccoshield_quality.check_image_quality",
        "api_endpoint": "POST /check-image-quality",
        "response_schema": QualityCheckResponse.schema(),
        "rejection_reasons": ["blur", "underexposed", "overexposed", "glare", "bad_framing"],
        "default_thresholds": {
            "blur_threshold": QualityConfig().blur_threshold,
            "brightness_min": QualityConfig().brightness_min,
            "brightness_max": QualityConfig().brightness_max,
            "max_glare_area_pct": QualityConfig().max_glare_area_pct,
            "min_framing_confidence": QualityConfig().min_framing_confidence,
        },
    }


@app.post(
    "/check-image-quality",
    response_model=QualityCheckResponse,
    status_code=status.HTTP_200_OK,
    tags=["Quality Assessment"],
    summary="Inspect buccal mucosa image quality",
    description=(
        "Accepts binary image uploads (multipart/form-data) OR JSON base64 string. "
        "Runs blur, exposure, glare, and framing checks and returns standardized quality audit dict."
    ),
)
async def check_image_quality_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None, description="Multipart binary image file upload"),
    body: Optional[Base64ImageRequest] = Body(None),
) -> Dict[str, Any]:
    """
    HTTP POST handler supporting both multipart form file upload and Base64 JSON payload.
    """
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
