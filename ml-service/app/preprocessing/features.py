from typing import Any

import pandas as pd


def extract_time_features(timestamps: pd.Series) -> pd.DataFrame:
    dt = pd.to_datetime(timestamps)
    return pd.DataFrame(
        {
            "hour": dt.dt.hour,
            "minute": dt.dt.minute,
            "second": dt.dt.second,
            "day_of_week": dt.dt.dayofweek,
            "day_of_month": dt.dt.day,
            "month": dt.dt.month,
            "is_weekend": (dt.dt.dayofweek >= 5).astype(int),
            "is_business_hours": ((dt.dt.hour >= 9) & (dt.dt.hour <= 17)).astype(int),
        }
    )


def extract_categorical_features(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    dummies = pd.get_dummies(df[columns], prefix=columns, dtype=int)
    return dummies


def extract_ip_features(ips: pd.Series, prefix: str = "") -> pd.DataFrame:
    features = pd.DataFrame(index=ips.index)
    features[f"{prefix}has_ip"] = ips.notna().astype(int)
    features[f"{prefix}first_octet"] = ips.apply(
        lambda x: int(str(x).split(".")[0]) if pd.notna(x) and "." in str(x) else 0
    )
    features[f"{prefix}is_private"] = ips.apply(_is_private_ip)
    features[f"{prefix}is_loopback"] = ips.apply(
        lambda x: 1 if pd.notna(x) and str(x).startswith("127.") else 0
    )
    features[f"{prefix}is_multicast"] = ips.apply(
        lambda x: 1 if pd.notna(x) and 224 <= int(str(x).split(".")[0]) <= 239 else 0
    )
    return features


def _is_private_ip(ip: Any) -> int:
    try:
        ip_str = str(ip)
        parts = ip_str.split(".")
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
    except Exception:
        return 0


def extract_metadata_features(metadata_series: pd.Series) -> pd.DataFrame:
    all_keys = set()
    for meta in metadata_series:
        if isinstance(meta, dict):
            for k, v in meta.items():
                if isinstance(v, (int, float, bool)):
                    all_keys.add(k)

    features = pd.DataFrame(index=metadata_series.index)
    for key in sorted(all_keys):
        col_name = f"meta_{key}"
        features[col_name] = metadata_series.apply(
            lambda x, key=key: x.get(key, 0) if isinstance(x, dict) and key in x else 0
        )

    return features.fillna(0)


def engineer_features(
    df: pd.DataFrame,
    feature_names: list[str] | None = None,
) -> pd.DataFrame:
    df = df.copy()

    if "timestamp" in df.columns:
        time_features = extract_time_features(df["timestamp"])
        df = pd.concat([df, time_features], axis=1)

    categorical_cols = [c for c in ["event_type", "severity"] if c in df.columns]
    if categorical_cols:
        cat_features = extract_categorical_features(df, categorical_cols)
        df = pd.concat([df, cat_features], axis=1)

    if "source_ip" in df.columns:
        ip_features = extract_ip_features(df["source_ip"], "src_")
        df = pd.concat([df, ip_features], axis=1)

    if "dest_ip" in df.columns:
        ip_features = extract_ip_features(df["dest_ip"], "dst_")
        df = pd.concat([df, ip_features], axis=1)

    if "metadata" in df.columns:
        meta_features = extract_metadata_features(df["metadata"])
        df = pd.concat([df, meta_features], axis=1)

    if feature_names:
        for col in feature_names:
            if col not in df.columns:
                df[col] = 0
        df = df[feature_names]

    return df.fillna(0)


def prepare_training_data(
    events: list[dict[str, Any]],
    window_minutes: int = 5,
) -> pd.DataFrame:
    df = pd.DataFrame(events)
    if df.empty:
        return pd.DataFrame()

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")

    features_list = []
    for i in range(len(df)):
        window_start = df.iloc[i]["timestamp"] - pd.Timedelta(minutes=window_minutes)
        window_events = df[
            (df["timestamp"] >= window_start) & (df["timestamp"] <= df.iloc[i]["timestamp"])
        ]

        agg_features = {
            "event_count": len(window_events),
            "unique_event_types": (
                window_events["event_type"].nunique()
                if "event_type" in window_events.columns
                else 0
            ),
            "unique_source_ips": (
                window_events["source_ip"].nunique() if "source_ip" in window_events.columns else 0
            ),
            "unique_dest_ips": (
                window_events["dest_ip"].nunique() if "dest_ip" in window_events.columns else 0
            ),
            "unique_users": (
                window_events["username"].nunique() if "username" in window_events.columns else 0
            ),
            "severity_critical": (
                (window_events["severity"] == "CRITICAL").sum()
                if "severity" in window_events.columns
                else 0
            ),
            "severity_high": (
                (window_events["severity"] == "HIGH").sum()
                if "severity" in window_events.columns
                else 0
            ),
            "severity_medium": (
                (window_events["severity"] == "MEDIUM").sum()
                if "severity" in window_events.columns
                else 0
            ),
            "severity_low": (
                (window_events["severity"] == "LOW").sum()
                if "severity" in window_events.columns
                else 0
            ),
            "severity_info": (
                (window_events["severity"] == "INFO").sum()
                if "severity" in window_events.columns
                else 0
            ),
        }

        current_event = window_events.iloc[-1]
        for k, v in agg_features.items():
            current_event[f"window_{k}"] = v

        features_list.append(current_event)

    result = pd.DataFrame(features_list)
    return engineer_features(result)
