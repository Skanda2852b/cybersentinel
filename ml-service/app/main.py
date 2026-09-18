from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.api import predict, health, model
from app.config import settings

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ML Service...")
    yield
    logger.info("Shutting down ML Service...")


app = FastAPI(
    title="CyberSentinel ML Service",
    description="Anomaly detection API for security events",
    version=settings.MODEL_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(predict.router, prefix="/api/v1", tags=["Prediction"])
app.include_router(model.router, prefix="/api/v1/model", tags=["Model"])


@app.get("/")
async def root():
    return {
        "service": "CyberSentinel ML Service",
        "version": settings.MODEL_VERSION,
        "status": "running",
    }