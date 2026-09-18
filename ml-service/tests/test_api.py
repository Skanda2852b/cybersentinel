import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "CyberSentinel ML Service"
    assert "version" in data


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "CyberSentinel ML Service"
    assert "status" in data


def test_predict_endpoint_validation():
    response = client.post("/api/v1/predict", json={"events": []})
    assert response.status_code == 422


def test_predict_endpoint_structure():
    response = client.post("/api/v1/predict", json={
        "events": [{
            "timestamp": "2024-01-15T10:30:45Z",
            "event_type": "ssh_failed_login",
            "severity": "HIGH",
            "source_ip": "192.168.1.100",
            "dest_ip": "10.0.0.10",
            "username": "root",
            "metadata": {"count": 5}
        }]
    })
    assert response.status_code == 200
    data = response.json()
    assert "predictions" in data
    assert "model_version" in data
    assert "processing_time_ms" in data
    assert len(data["predictions"]) == 1
    assert "anomaly_score" in data["predictions"][0]
    assert "is_anomaly" in data["predictions"][0]


def test_model_info():
    response = client.get("/api/v1/model/info")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "path" in data
    assert "exists" in data


def test_features_endpoint():
    response = client.get("/api/v1/features")
    assert response.status_code == 200
    data = response.json()
    assert "feature_names" in data
    assert "model_version" in data
    assert "expected_events_minimum" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])