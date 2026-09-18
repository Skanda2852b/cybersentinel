# CyberSentinel ML Service

Machine Learning anomaly detection service for the CyberSentinel SIEM platform.

## Overview

This service provides real-time anomaly detection for security events using Isolation Forest algorithm. It receives normalized event features from the backend and returns anomaly scores.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Backend       │────▶│  ML Service      │────▶│  Model Store    │
│   (Feature Eng) │     │  (Inference)     │     │  (Joblib)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌──────────────────┐
                        │  Training Job    │
                        │  (Scheduled)     │
                        └──────────────────┘
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with model status |
| GET | `/ready` | Readiness check |
| POST | `/api/v1/predict` | Anomaly detection on events |
| GET | `/api/v1/predict/features` | Model feature information |
| GET | `/api/v1/model/info` | Model metadata |
| POST | `/api/v1/model/train` | Train new model (sync) |
| POST | `/api/v1/model/train/async` | Train new model (async) |
| DELETE | `/api/v1/model` | Delete current model |

## Request/Response Examples

### Predict Anomaly

**Request:**
```json
POST /api/v1/predict
{
  "events": [
    {
      "timestamp": "2024-01-15T10:30:45Z",
      "event_type": "ssh_failed_login",
      "severity": "HIGH",
      "source_ip": "192.168.1.100",
      "dest_ip": "10.0.0.10",
      "username": "root",
      "metadata": {"count": 5, "port": 22}
    }
  ],
  "source_id": "src-1"
}
```

**Response:**
```json
{
  "predictions": [
    {
      "event_index": 0,
      "anomaly_score": 0.85,
      "is_anomaly": true,
      "features_used": {
        "hour": 10,
        "minute": 30,
        "event_type_ssh_failed_login": 1,
        "severity_HIGH": 1,
        "src_is_private": 1,
        ...
      }
    }
  ],
  "model_version": "1.0.0",
  "processing_time_ms": 12.5
}
```

## Model Training

The service uses Isolation Forest for unsupervised anomaly detection:

```bash
# Train manually
curl -X POST http://localhost:8000/api/v1/model/train \
  -H "Content-Type: application/json" \
  -d '{"contamination": 0.01, "n_estimators": 200}'

# Or run training script directly
python -m app.training.train
```

### Training Data Format

Training data should be in Parquet format with columns:
- `timestamp`: ISO 8601 timestamp
- `event_type`: String event category
- `severity`: CRITICAL, HIGH, MEDIUM, LOW, INFO
- `source_ip`: Source IP address (optional)
- `dest_ip`: Destination IP address (optional)
- `username`: Username (optional)
- `metadata`: JSON object with additional numeric fields

## Feature Engineering

The service automatically engineers features from raw events:

- **Temporal**: hour, minute, day_of_week, is_weekend, is_business_hours
- **Categorical**: One-hot encoded event_type and severity
- **Network**: IP octets, private/loopback/multicast flags
- **Metadata**: Numeric fields from metadata JSON
- **Windowed**: Aggregated counts over sliding time windows

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `ML_SERVICE_HOST` | 0.0.0.0 | Server host |
| `ML_SERVICE_PORT` | 8000 | Server port |
| `MODEL_PATH` | /app/models/isolation_forest.joblib | Model file path |
| `CONTAMINATION` | 0.01 | Expected anomaly proportion |
| `N_ESTIMATORS` | 200 | Number of trees in forest |
| `MAX_SAMPLES` | 256 | Samples per tree |
| `RANDOM_STATE` | 42 | Random seed |
| `FEATURE_WINDOW_MINUTES` | 5 | Sliding window for aggregations |
| `MIN_EVENTS_FOR_INFERENCE` | 10 | Minimum events for prediction |

## Development

```bash
# Install dependencies
cd ml-service
pip install -e ".[dev]"

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest tests/ -v

# Lint
ruff check .
black --check .

# Type check
mypy app
```

## Docker

```bash
# Development
docker-compose up ml-service

# Production build
docker build -t cybersentinel-ml-service -f ml-service/Dockerfile ml-service --target production
```

## Model Versioning

Models are versioned via `MODEL_VERSION` environment variable. Each training run increments the version. The model file includes:
- Scikit-learn pipeline (scaler + model)
- Feature names list
- Training metadata (date, params, sample count)

## Monitoring

Key metrics to monitor:
- `/health` - Model loaded status
- Prediction latency (target < 50ms)
- Anomaly rate (should be ~contamination %)
- Model age (retrain weekly)

## Security

- No authentication on ML service (internal network only)
- Input validation on all endpoints
- Rate limiting handled by backend
- Model files stored in isolated volume