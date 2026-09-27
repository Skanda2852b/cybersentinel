import logging
import os
from datetime import datetime
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.preprocessing.features import prepare_training_data

logger = logging.getLogger(__name__)


def train_model(
    data_path: str,
    contamination: float = 0.01,
    n_estimators: int = 200,
    max_samples: int = 256,
    random_state: int = 42,
    output_path: str = "/app/models/isolation_forest.joblib",
) -> dict[str, Any]:
    if not os.path.exists(data_path):
        logger.info(f"Training data not found at {data_path}, generating synthetic data...")
        df = generate_synthetic_training_data()
    else:
        df = pd.read_parquet(data_path)

    features_df = prepare_training_data(df.to_dict("records"))

    feature_names = [
        c
        for c in features_df.columns
        if c
        not in [
            "timestamp",
            "event_type",
            "severity",
            "source_ip",
            "dest_ip",
            "username",
            "metadata",
        ]
    ]
    x = features_df[feature_names].fillna(0)

    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)

    model = IsolationForest(
        contamination=contamination,
        n_estimators=n_estimators,
        max_samples=max_samples,
        random_state=random_state,
        n_jobs=-1,
    )

    model.fit(x_scaled)

    pipeline = Pipeline(
        [
            ("scaler", scaler),
            ("model", model),
        ]
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    model_data = {
        "model": pipeline,
        "feature_names": feature_names,
        "training_date": datetime.utcnow().isoformat(),
        "contamination": contamination,
        "n_estimators": n_estimators,
        "max_samples": max_samples,
        "random_state": random_state,
        "n_samples": len(x),
        "n_features": len(feature_names),
    }

    joblib.dump(model_data, output_path)

    logger.info(f"Model saved to {output_path}")
    logger.info(f"Features: {len(feature_names)}, Samples: {len(x)}")

    return {
        "version": "1.0.0",
        "path": output_path,
        "exists": True,
        "size_bytes": os.path.getsize(output_path),
        "feature_count": len(feature_names),
        "training_date": model_data["training_date"],
    }


def generate_synthetic_training_data(n_samples: int = 10000) -> pd.DataFrame:
    np.random.seed(42)

    base_time = pd.Timestamp("2024-01-01 00:00:00")
    timestamps = [base_time + pd.Timedelta(seconds=i * 10) for i in range(n_samples)]

    event_types = [
        "ssh_failed_login",
        "ssh_success_login",
        "connection_attempt",
        "dns_query",
        "http_request",
        "file_access",
        "process_start",
        "network_connection",
        "registry_change",
        "scheduled_task",
    ]

    severities = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
    severity_weights = [0.5, 0.3, 0.15, 0.04, 0.01]

    data = []
    for ts in timestamps:
        is_anomaly = np.random.random() < 0.02

        if is_anomaly:
            event_type = np.random.choice(
                ["ssh_failed_login", "connection_attempt", "network_connection"], p=[0.5, 0.3, 0.2]
            )
            severity = np.random.choice(["HIGH", "CRITICAL", "MEDIUM"], p=[0.5, 0.3, 0.2])
            source_ip = f"192.168.{np.random.randint(1,255)}.{np.random.randint(1,255)}"
            count = np.random.randint(20, 100)
        else:
            event_type = np.random.choice(event_types)
            severity = np.random.choice(severities, p=severity_weights)
            source_ip = f"10.0.{np.random.randint(1,255)}.{np.random.randint(1,255)}"
            count = np.random.randint(1, 5)

        data.append(
            {
                "timestamp": ts.isoformat(),
                "event_type": event_type,
                "severity": severity,
                "source_ip": source_ip,
                "dest_ip": (
                    f"10.0.0.{np.random.randint(1,255)}" if np.random.random() > 0.3 else None
                ),
                "username": f"user{np.random.randint(1,50)}" if np.random.random() > 0.5 else None,
                "metadata": {"count": count, "port": np.random.randint(1, 65535)},
            }
        )

    return pd.DataFrame(data)


if __name__ == "__main__":
    train_model(
        data_path="/app/datasets/training_data.parquet",
        output_path="/app/models/isolation_forest.joblib",
    )
