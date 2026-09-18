from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import logging

from app.config import settings
from app.training.train import train_model

router = APIRouter()
logger = logging.getLogger(__name__)


class ModelInfo(BaseModel):
    version: str
    path: str
    exists: bool
    size_bytes: Optional[int] = None
    feature_count: Optional[int] = None
    training_date: Optional[str] = None


class TrainRequest(BaseModel):
    data_path: Optional[str] = None
    contamination: Optional[float] = None
    n_estimators: Optional[int] = None
    max_samples: Optional[int] = None
    random_state: Optional[int] = None


class TrainResponse(BaseModel):
    success: bool
    message: str
    model_info: Optional[ModelInfo] = None


@router.get("/info", response_model=ModelInfo)
async def get_model_info():
    exists = os.path.exists(settings.MODEL_PATH)
    size = os.path.getsize(settings.MODEL_PATH) if exists else None

    import joblib
    feature_count = None
    training_date = None
    if exists:
        try:
            model_data = joblib.load(settings.MODEL_PATH)
            feature_count = len(model_data.get("feature_names", []))
            training_date = model_data.get("training_date")
        except:
            pass

    return ModelInfo(
        version=settings.MODEL_VERSION,
        path=settings.MODEL_PATH,
        exists=exists,
        size_bytes=size,
        feature_count=feature_count,
        training_date=training_date,
    )


@router.post("/train", response_model=TrainResponse)
async def train_new_model(request: TrainRequest, background_tasks: BackgroundTasks):
    if os.path.exists(settings.MODEL_PATH):
        try:
            os.remove(settings.MODEL_PATH)
        except:
            pass

    try:
        result = train_model(
            data_path=request.data_path or settings.TRAINING_DATA_PATH,
            contamination=request.contamination or settings.CONTAMINATION,
            n_estimators=request.n_estimators or settings.N_ESTIMATORS,
            max_samples=request.max_samples or settings.MAX_SAMPLES,
            random_state=request.random_state or settings.RANDOM_STATE,
            output_path=settings.MODEL_PATH,
        )
        return TrainResponse(
            success=True,
            message="Model trained successfully",
            model_info=ModelInfo(**result),
        )
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/train/async", response_model=TrainResponse)
async def train_new_model_async(request: TrainRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        train_model,
        data_path=request.data_path or settings.TRAINING_DATA_PATH,
        contamination=request.contamination or settings.CONTAMINATION,
        n_estimators=request.n_estimators or settings.N_ESTIMATORS,
        max_samples=request.max_samples or settings.MAX_SAMPLES,
        random_state=request.random_state or settings.RANDOM_STATE,
        output_path=settings.MODEL_PATH,
    )
    return TrainResponse(
        success=True,
        message="Training started in background",
    )


@router.delete("/model")
async def delete_model():
    if os.path.exists(settings.MODEL_PATH):
        os.remove(settings.MODEL_PATH)
        return {"success": True, "message": "Model deleted"}
    raise HTTPException(status_code=404, detail="Model not found")