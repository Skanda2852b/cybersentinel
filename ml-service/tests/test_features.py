import pandas as pd
import pytest

from app.preprocessing.features import (
    engineer_features,
    extract_ip_features,
    extract_metadata_features,
    extract_time_features,
    prepare_training_data,
)


def test_extract_time_features():
    timestamps = pd.Series(
        [
            "2024-01-15T10:30:45Z",
            "2024-01-15T23:59:59Z",
            "2024-01-14T00:00:00Z",
        ]
    )
    features = extract_time_features(timestamps)

    assert "hour" in features.columns
    assert "minute" in features.columns
    assert "day_of_week" in features.columns
    assert features.iloc[0]["hour"] == 10
    assert features.iloc[0]["minute"] == 30
    assert features.iloc[1]["hour"] == 23
    assert features.iloc[2]["is_weekend"] == 1


def test_extract_ip_features():
    ips = pd.Series(["192.168.1.100", "10.0.0.50", "8.8.8.8", None, "127.0.0.1"])
    features = extract_ip_features(ips, "test_")

    assert "test_has_ip" in features.columns
    assert "test_is_private" in features.columns
    assert "test_is_loopback" in features.columns
    assert features.iloc[0]["test_is_private"] == 1
    assert features.iloc[1]["test_is_private"] == 1
    assert features.iloc[2]["test_is_private"] == 0
    assert features.iloc[3]["test_has_ip"] == 0
    assert features.iloc[4]["test_is_loopback"] == 1


def test_extract_metadata_features():
    metadata = pd.Series(
        [
            {"count": 5, "port": 22},
            {"count": 10, "bytes": 1024},
            {"port": 443},
            "not a dict",
            None,
        ]
    )
    features = extract_metadata_features(metadata)

    assert "meta_count" in features.columns
    assert "meta_port" in features.columns
    assert "meta_bytes" in features.columns
    assert features.iloc[0]["meta_count"] == 5
    assert features.iloc[1]["meta_count"] == 10
    assert features.iloc[2]["meta_count"] == 0


def test_engineer_features():
    df = pd.DataFrame(
        [
            {
                "timestamp": "2024-01-15T10:30:45Z",
                "event_type": "ssh_failed_login",
                "severity": "HIGH",
                "source_ip": "192.168.1.100",
                "dest_ip": "10.0.0.10",
                "username": "root",
                "metadata": {"count": 5, "port": 22},
            }
        ]
    )

    features = engineer_features(df)

    assert "hour" in features.columns
    assert "event_type_ssh_failed_login" in features.columns
    assert "severity_HIGH" in features.columns
    assert "src_has_ip" in features.columns
    assert "src_is_private" in features.columns
    assert "dst_has_ip" in features.columns
    assert "meta_count" in features.columns
    assert "meta_port" in features.columns


def test_prepare_training_data():
    events = [
        {
            "timestamp": "2024-01-15T10:30:00Z",
            "event_type": "ssh_failed_login",
            "severity": "HIGH",
            "source_ip": "192.168.1.100",
            "dest_ip": "10.0.0.10",
            "username": "root",
            "metadata": {"count": 5},
        },
        {
            "timestamp": "2024-01-15T10:30:10Z",
            "event_type": "ssh_failed_login",
            "severity": "HIGH",
            "source_ip": "192.168.1.100",
            "dest_ip": "10.0.0.10",
            "username": "root",
            "metadata": {"count": 5},
        },
    ]

    features = prepare_training_data(events, window_minutes=5)

    assert len(features) == 2
    assert "window_event_count" in features.columns
    assert features.iloc[1]["window_event_count"] == 2
    assert features.iloc[0]["window_event_count"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
