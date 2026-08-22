"""
Direct prediction endpoint for Oral Cancer ML model (Member C).
Supports standalone testing via Swagger, curl, or mobile/web client.
"""
from typing import Optional
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from tobaccoshield_risk.model import predict_image, classify_risk

router = APIRouter(tags=["ML Prediction"])


@router.post(
    "/predict",
    summary="Predict Oral Cancer Risk from uploaded image",
    description="Upload an image (multipart/form-data) to run direct MobileNetV2 inference.",
    status_code=status.HTTP_200_OK,
)
async def predict_endpoint(
    image: Optional[UploadFile] = File(None, description="Image file field named 'image'"),
    file: Optional[UploadFile] = File(None, description="Alternative image file field named 'file'"),
):
    upload = image or file
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image uploaded. Please provide 'image' or 'file' in multipart form data.",
        )

    try:
        image_bytes = await upload.read()
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        # Basic predict result
        pred_result = predict_image(image_bytes)

        # Full contract classification result
        contract_result = classify_risk(image_bytes)

        return {
            "prediction": pred_result["prediction"],
            "confidence": pred_result["confidence"],
            "risk_category": contract_result["risk_category"],
            "cannot_assess": contract_result["cannot_assess"],
            "probabilities": pred_result.get("probabilities", {}),
            "model_version": contract_result["model_version"],
            "timestamp": contract_result["timestamp"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}",
        )
