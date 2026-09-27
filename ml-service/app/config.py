from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ML_SERVICE_HOST: str = "0.0.0.0"
    ML_SERVICE_PORT: int = 8000
    ML_SERVICE_WORKERS: int = 4

    MODEL_PATH: str = "/app/models/isolation_forest.joblib"
    MODEL_VERSION: str = "1.0.0"
    CONTAMINATION: float = 0.01
    N_ESTIMATORS: int = 200
    MAX_SAMPLES: int = 256
    RANDOM_STATE: int = 42

    FEATURE_WINDOW_MINUTES: int = 5
    MIN_EVENTS_FOR_INFERENCE: int = 10

    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    TRAINING_DATA_PATH: str = "/app/datasets/training_data.parquet"
    RETRAIN_SCHEDULE_CRON: str = "0 3 * * 0"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
