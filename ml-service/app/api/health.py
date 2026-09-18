from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

from app.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool
    model_path: str
    model_exists: bool


@router.get("/health", response_model=HealthResponse)
async def health_check():
    model_exists = os.path.exists(settings.MODEL_PATH)
    return HealthResponse(
        status="healthy" if model_exists else "degraded",
        service="CyberSentinel ML Service",
        version=settings.MODEL_VERSION,
        model_loaded=model_exists,
        model_path=settings.MODEL_PATH,
        model_exists=model_exists,
    )


@router.get("/ready")
async def readiness_check():
    if not os.path.exists(settings.MODEL_PATH):
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"status": "ready"}