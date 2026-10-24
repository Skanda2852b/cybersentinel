import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_predict_batch_events():
    """Test batch prediction with multiple events."""
    response = client.post(
        "/api/v1/predict",
        json={
            "events": [
                {
                    "timestamp": "2024-01-15T10:30:45Z",
                    "event_type": "ssh_failed_login",
                    "severity": "HIGH",
                    "source_ip": "192.168.1.100",
                    "dest_ip": "10.0.0.10",
                    "username": "root",
                    "metadata": {"count": 5},
                },
                {
                    "timestamp": "2024-01-15T10:31:00Z",
                    "event_type": "connection_attempt",
                    "severity": "MEDIUM",
                    "source_ip": "10.0.0.50",
                    "dest_ip": "192.168.1.1",
                    "username": "admin",
                    "metadata": {"port": 443},
                },
            ]
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert "model_version" in data
    assert "processing_time_ms" in data
    assert len(data["predictions"]) == 2
    for pred in data["predictions"]:
        assert "event_index" in pred
        assert "anomaly_score" in pred
        assert "is_anomaly" in pred
        assert "features_used" in pred
        assert 0 <= pred["anomaly_score"] <= 1


def test_predict_max_events_limit():
    """Test that predict rejects more than 1000 events."""
    events = [
        {
            "timestamp": "2024-01-15T10:30:45Z",
            "event_type": "ssh_failed_login",
            "severity": "HIGH",
            "source_ip": "192.168.1.100",
            "metadata": {},
        }
    ] * 1001
    response = client.post("/api/v1/predict", json={"events": events})
    assert response.status_code == 422


def test_predict_missing_required_fields():
    """Test that predict rejects events missing required fields."""
    response = client.post(
        "/api/v1/predict",
        json={
            "events": [
                {
                    "timestamp": "2024-01-15T10:30:45Z",
                    # Missing event_type and severity
                }
            ]
        },
    )
    assert response.status_code == 422


def test_predict_invalid_severity():
    """Test that predict accepts any severity string (no enum validation on severity)."""
    response = client.post(
        "/api/v1/predict",
        json={
            "events": [
                {
                    "timestamp": "2024-01-15T10:30:45Z",
                    "event_type": "ssh_failed_login",
                    "severity": "INVALID",
                    "metadata": {},
                }
            ]
        },
    )
    assert response.status_code == 200


def test_model_train_endpoint():
    """Test the model training endpoint."""
    response = client.post(
        "/api/v1/model/train",
        json={
            "contamination": 0.05,
            "n_estimators": 10,
            "max_samples": 50,
            "random_state": 42,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["message"] == "Model trained successfully"


def test_model_delete_endpoint():
    """Test the model delete endpoint."""
    response = client.delete("/api/v1/model")
    assert response.status_code in (200, 404)


def test_readiness_when_model_missing():
    """Test readiness endpoint when model is missing."""
    response = client.get("/ready")
    # May be 503 if no model, or 200 if model exists from previous test
    assert response.status_code in (200, 503)


def test_predict_with_null_optional_fields():
    """Test prediction with null optional fields."""
    response = client.post(
        "/api/v1/predict",
        json={
            "events": [
                {
                    "timestamp": "2024-01-15T10:30:45Z",
                    "event_type": "ssh_failed_login",
                    "severity": "LOW",
                    "source_ip": None,
                    "dest_ip": None,
                    "username": None,
                    "metadata": {},
                }
            ]
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["predictions"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
