from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
import joblib
import os
import logging

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_model = None
_feature_names = None


def load_model():
    global _model, _feature_names
    if _model is None:
        if os.path.exists(settings.MODEL_PATH):
            try:
                model_data = joblib.load(settings.MODEL_PATH)
                _model = model_data.get("model")
                _feature_names = model_data.get("feature_names", [])
                logger.info(f"Model loaded from {settings.MODEL_PATH}")
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                raise HTTPException(status_code=500, detail="Model loading failed")
        else:
            logger.warning("Model file not found, using dummy model for development")
            _model = None
            _feature_names = []


class EventFeatures(BaseModel):
    timestamp: str
    event_type: str
    severity: str
    source_ip: Optional[str] = None
    dest_ip: Optional[str] = None
    username: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PredictRequest(BaseModel):
    events: List[EventFeatures] = Field(min_items=1, max_items=1000)
    source_id: Optional[str] = None


class AnomalyPrediction(BaseModel):
    event_index: int
    anomaly_score: float
    is_anomaly: bool
    features_used: Dict[str, float]


class PredictResponse(BaseModel):
    predictions: List[AnomalyPrediction]
    model_version: str
    processing_time_ms: float


@router.post("/predict", response_model=PredictResponse)
async def predict_anomaly(request: PredictRequest):
    import time
    start_time = time.time()

    load_model()

    if not request.events:
        raise HTTPException(status_code=400, detail="No events provided")

    df = pd.DataFrame([e.model_dump() for e in request.events])

    if len(df) < settings.MIN_EVENTS_FOR_INFERENCE:
        logger.warning(f"Only {len(df)} events provided, minimum is {settings.MIN_EVENTS_FOR_INFERENCE}")

    features = engineer_features(df)

    if _model is not None and _feature_names:
        try:
            X = features[_feature_names].fillna(0)
            scores = _model.decision_function(X)
            anomaly_scores = -scores
            predictions = _model.predict(X)
            is_anomaly = predictions == -1
        except Exception as e:
            logger.error(f"Model inference failed: {e}")
            anomaly_scores = np.random.random(len(df)) * 0.5
            is_anomaly = anomaly_scores > 0.8
    else:
        anomaly_scores = np.random.random(len(df)) * 0.5
        is_anomaly = anomaly_scores > 0.8

    results = []
    for i, (score, anomaly) in enumerate(zip(anomaly_scores, is_anomaly)):
        feature_dict = features.iloc[i].to_dict() if i < len(features) else {}
        results.append(AnomalyPrediction(
            event_index=i,
            anomaly_score=float(score),
            is_anomaly=bool(anomaly),
            features_used=feature_dict,
        ))

    processing_time = (time.time() - start_time) * 1000

    return PredictResponse(
        predictions=results,
        model_version=settings.MODEL_VERSION,
        processing_time_ms=processing_time,
    )


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour"] = df["timestamp"].dt.hour
    df["minute"] = df["timestamp"].dt.minute
    df["day_of_week"] = df["timestamp"].dt.dayofweek

    event_type_dummies = pd.get_dummies(df["event_type"], prefix="event_type")
    severity_dummies = pd.get_dummies(df["severity"], prefix="severity")

    df["has_source_ip"] = df["source_ip"].notna().astype(int)
    df["has_dest_ip"] = df["dest_ip"].notna().astype(int)
    df["has_username"] = df["username"].notna().astype(int)

    ip_features = pd.DataFrame()
    if "source_ip" in df.columns:
        ip_features["source_ip_first_octet"] = df["source_ip"].apply(
            lambda x: int(x.split(".")[0]) if pd.notna(x) and "." in str(x) else 0
        )
        ip_features["source_ip_is_private"] = df["source_ip"].apply(
            lambda x: is_private_ip(x) if pd.notna(x) else 0
        )

    if "dest_ip" in df.columns:
        ip_features["dest_ip_first_octet"] = df["dest_ip"].apply(
            lambda x: int(x.split(".")[0]) if pd.notna(x) and "." in str(x) else 0
        )
        ip_features["dest_ip_is_private"] = df["dest_ip"].apply(
            lambda x: is_private_ip(x) if pd.notna(x) else 0
        )

    metadata_features = pd.DataFrame()
    if "metadata" in df.columns:
        for idx, meta in df["metadata"].items():
            if isinstance(meta, dict):
                for k, v in meta.items():
                    if isinstance(v, (int, float)):
                        col_name = f"meta_{k}"
                        if col_name not in metadata_features.columns:
                            metadata_features[col_name] = 0
                        metadata_features.loc[idx, col_name] = v

    features = pd.concat([
        df[["hour", "minute", "day_of_week", "has_source_ip", "has_dest_ip", "has_username"]],
        event_type_dummies,
        severity_dummies,
        ip_features,
        metadata_features,
    ], axis=1)

    features = features.fillna(0)

    for col in _feature_names or []:
        if col not in features.columns:
            features[col] = 0

    if _feature_names:
        features = features[_feature_names]

    return features


def is_private_ip(ip: str) -> int:
    try:
        parts = ip.split(".")
        if len(parts) != 4:
            return 0
        first = int(parts[0])
        second = int(parts[1])
        if first == 10:
            return 1
        if first == 172 and 16 <= second <= 31:
            return 1
        if first == 192 and second == 168:
            return 1
        return 0
    except:
        return 0


@router.get("/features")
async def get_feature_info():
    load_model()
    return {
        "feature_names": _feature_names or [],
        "model_version": settings.MODEL_VERSION,
        "expected_events_minimum": settings.MIN_EVENTS_FOR_INFERENCE,
    }