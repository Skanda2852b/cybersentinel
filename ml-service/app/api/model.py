import contextlib
import logging
import os

import joblib
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.training.train import train_model

router = APIRouter()
logger = logging.getLogger(__name__)


class ModelInfo(BaseModel):
    version: str
    path: str
    exists: bool
    size_bytes: int | None = None
    feature_count: int | None = None
    training_date: str | None = None


class TrainRequest(BaseModel):
    data_path: str | None = None
    contamination: float | None = None
    n_estimators: int | None = None
    max_samples: int | None = None
    random_state: int | None = None


class TrainResponse(BaseModel):
    success: bool
    message: str
    model_info: ModelInfo | None = None


@router.get("/info", response_model=ModelInfo)
async def get_model_info() -> ModelInfo:
    exists = os.path.exists(settings.MODEL_PATH)
    size = os.path.getsize(settings.MODEL_PATH) if exists else None

    feature_count = None
    training_date = None
    if exists:
        with contextlib.suppress(Exception):
            model_data = joblib.load(settings.MODEL_PATH)
            feature_count = len(model_data.get("feature_names", []))
            training_date = model_data.get("training_date")

    return ModelInfo(
        version=settings.MODEL_VERSION,
        path=settings.MODEL_PATH,
        exists=exists,
        size_bytes=size,
        feature_count=feature_count,
        training_date=training_date,
    )


@router.post("/train", response_model=TrainResponse)
async def train_new_model(
    request: TrainRequest, background_tasks: BackgroundTasks
) -> TrainResponse:
    if os.path.exists(settings.MODEL_PATH):
        with contextlib.suppress(OSError):
            os.remove(settings.MODEL_PATH)

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
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}") from e


@router.post("/train/async", response_model=TrainResponse)
async def train_new_model_async(
    request: TrainRequest, background_tasks: BackgroundTasks
) -> TrainResponse:
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
async def delete_model() -> dict[str, bool | str]:
    if os.path.exists(settings.MODEL_PATH):
        os.remove(settings.MODEL_PATH)
        return {"success": True, "message": "Model deleted"}
    raise HTTPException(status_code=404, detail="Model not found")
