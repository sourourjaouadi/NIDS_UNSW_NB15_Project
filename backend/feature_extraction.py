"""
CSV feature preparation for UNSW-NB15 model input.

The backend accepts flow-level CSV rows only. Uploaded rows are normalized to the
38 model features, enriched with count-window defaults when possible, then
encoded and scaled for the trained classifiers.
"""

from __future__ import annotations

import io
import logging
import os
import pickle
import warnings
from collections import deque
from typing import Any, Dict, Iterable, List

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


MODEL_FEATURES = [
    "sport", "dsport", "proto", "state", "dur", "sbytes", "dbytes",
    "sttl", "dttl", "service", "sload", "dload", "spkts", "dpkts",
    "dwin", "stcpb", "dtcpb", "trans_depth", "res_bdy_len", "sjit",
    "djit", "sintpkt", "dintpkt", "tcprtt", "synack", "ackdat",
    "is_sm_ips_ports", "ct_state_ttl", "ct_flw_http_mthd", "is_ftp_login",
    "ct_ftp_cmd", "ct_srv_src", "ct_srv_dst", "ct_dst_ltm", "ct_src_ltm",
    "ct_src_dport_ltm", "ct_dst_sport_ltm", "ct_dst_src_ltm",
]

FEATURE_NAMES = MODEL_FEATURES

FEATURE_DEFAULTS: Dict[str, Any] = {
    name: 0 for name in FEATURE_NAMES
}
FEATURE_DEFAULTS.update({
    "proto": "tcp",
    "state": "CON",
    "service": "none",
    "ct_srv_src": 1,
    "ct_srv_dst": 1,
    "ct_dst_ltm": 1,
    "ct_src_ltm": 1,
    "ct_src_dport_ltm": 1,
    "ct_dst_sport_ltm": 1,
    "ct_dst_src_ltm": 1,
})

COUNT_FEATURES = {
    "ct_state_ttl",
    "ct_srv_src",
    "ct_srv_dst",
    "ct_dst_ltm",
    "ct_src_ltm",
    "ct_src_dport_ltm",
    "ct_dst_sport_ltm",
    "ct_dst_src_ltm",
}

CICFLOWMETER_ALIASES = {
    "Src Port": "sport",
    "Source Port": "sport",
    "Sport": "sport",
    "Dst Port": "dsport",
    "Destination Port": "dsport",
    "Dport": "dsport",
    "Protocol": "proto",
    "Flow Duration": "dur",
    "Total Fwd Packets": "spkts",
    "Tot Fwd Pkts": "spkts",
    "Total Backward Packets": "dpkts",
    "Tot Bwd Pkts": "dpkts",
    "Total Length of Fwd Packets": "sbytes",
    "TotLen Fwd Pkts": "sbytes",
    "Fwd Header Length": "sbytes",
    "Total Length of Bwd Packets": "dbytes",
    "TotLen Bwd Pkts": "dbytes",
    "Bwd Header Length": "dbytes",
    "Fwd Packets/s": "sload",
    "Fwd Bytes/s": "sload",
    "Flow Bytes/s": "sload",
    "Bwd Packets/s": "dload",
    "Fwd IAT Mean": "sintpkt",
    "Bwd IAT Mean": "dintpkt",
    "Fwd IAT Std": "sjit",
    "Bwd IAT Std": "djit",
    "Init_Win_bytes_backward": "dwin",
    "Init Bwd Win Byts": "dwin",
    "Subflow Fwd Bytes": "sbytes",
    "Subflow Bwd Bytes": "dbytes",
    "Subflow Fwd Packets": "spkts",
    "Subflow Bwd Packets": "dpkts",
    "Fwd PSH Flags": "state",
    "SYN Flag Count": "synack",
    "ACK Flag Count": "ackdat",
}

NUMERIC_FEATURES = [name for name in FEATURE_NAMES if name not in {"proto", "state", "service"}]


def _canonical_column_name(name: str) -> str:
    stripped = name.strip()
    if stripped in FEATURE_NAMES:
        return stripped
    return CICFLOWMETER_ALIASES.get(stripped, stripped)


def parse_csv_to_feature_rows(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Read uploaded CSV bytes and return model feature rows.

    CICFlowMeter aliases are renamed to UNSW-NB15 feature names, non-feature
    columns are dropped, and missing features are filled with semantic defaults.
    """
    df = pd.read_csv(io.BytesIO(file_bytes))
    df = df.rename(columns={col: _canonical_column_name(str(col)) for col in df.columns})
    df = df.loc[:, ~df.columns.duplicated()]
    matched_columns = [col for col in df.columns if col in FEATURE_NAMES]
    df = df.reindex(columns=FEATURE_NAMES)

    for column, default in FEATURE_DEFAULTS.items():
        df[column] = df[column].fillna(default)

    missing_count = len(FEATURE_NAMES) - len(matched_columns)
    if missing_count:
        logger.warning(
            "CSV is missing %s/%s model feature columns. Missing values were filled with defaults.",
            missing_count,
            len(FEATURE_NAMES),
        )

    return df.to_dict(orient="records")


def compute_features(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalize CSV feature dictionaries and calculate UNSW count features when
    source/destination metadata is present.
    """
    feature_rows: List[Dict[str, Any]] = []
    window: deque[Dict[str, Any]] = deque(maxlen=100)

    for row in rows:
        normalized = {name: row.get(name, FEATURE_DEFAULTS[name]) for name in FEATURE_NAMES}
        _apply_semantic_fills(normalized)

        src_ip = row.get("srcip") or row.get("src_ip") or row.get("_src_ip")
        dst_ip = row.get("dstip") or row.get("dst_ip") or row.get("_dst_ip")
        if src_ip is not None and dst_ip is not None:
            normalized.update(_count_window_features(normalized, src_ip, dst_ip, window))
            window.append({
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "sport": normalized["sport"],
                "dsport": normalized["dsport"],
                "service": normalized["service"],
                "state": normalized["state"],
                "sttl": normalized["sttl"],
            })

        feature_rows.append(normalized)

    return feature_rows


def _apply_semantic_fills(row: Dict[str, Any]) -> None:
    for key, default in FEATURE_DEFAULTS.items():
        value = row.get(key)
        if pd.isna(value) or value == "":
            row[key] = default

    if str(row.get("service", "")).strip() in {"", "-", "nan", "None"}:
        row["service"] = "none"

    for key in ("ct_flw_http_mthd", "is_ftp_login", "ct_ftp_cmd"):
        row[key] = _to_number(row.get(key), 0)

    for key in NUMERIC_FEATURES:
        row[key] = _to_number(row.get(key), FEATURE_DEFAULTS[key])


def _count_window_features(
    row: Dict[str, Any],
    src_ip: Any,
    dst_ip: Any,
    window: deque[Dict[str, Any]],
) -> Dict[str, int]:
    candidates = list(window) + [{
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "sport": row["sport"],
        "dsport": row["dsport"],
        "service": row["service"],
        "state": row["state"],
        "sttl": row["sttl"],
    }]

    return {
        "ct_state_ttl": sum(1 for item in candidates if item["state"] == row["state"] and item["sttl"] == row["sttl"]),
        "ct_srv_src": sum(1 for item in candidates if item["src_ip"] == src_ip and item["service"] == row["service"]),
        "ct_srv_dst": sum(1 for item in candidates if item["dst_ip"] == dst_ip and item["service"] == row["service"]),
        "ct_dst_ltm": sum(1 for item in candidates if item["dst_ip"] == dst_ip),
        "ct_src_ltm": sum(1 for item in candidates if item["src_ip"] == src_ip),
        "ct_src_dport_ltm": sum(1 for item in candidates if item["src_ip"] == src_ip and item["dsport"] == row["dsport"]),
        "ct_dst_sport_ltm": sum(1 for item in candidates if item["dst_ip"] == dst_ip and item["sport"] == row["sport"]),
        "ct_dst_src_ltm": sum(1 for item in candidates if item["src_ip"] == src_ip and item["dst_ip"] == dst_ip),
    }


def _to_number(value: Any, default: Any) -> float:
    if pd.isna(value):
        return float(default)
    converted = pd.to_numeric(value, errors="coerce")
    if pd.isna(converted):
        return float(default)
    return float(converted)


def prepare_for_model(feature_dicts, scaler_path, feature_list=None, encoders=None):
    """Convert dictionaries to scaled and raw matrices."""
    if feature_list is None:
        feature_list = MODEL_FEATURES

    prepared = compute_features(feature_dicts)
    df = pd.DataFrame(prepared)

    X = df.reindex(columns=feature_list, fill_value=0)

    if encoders:
        for col, encoder in encoders.items():
            if col in X.columns and col in ["proto", "service", "state"]:
                try:
                    X[col] = X[col].apply(lambda value: _encode_category(value, encoder, col))
                except Exception as exc:
                    logger.warning("Encoding failed for %s: %s. Filling with 0.", col, exc)
                    X[col] = 0

    X = X.astype(float)
    X.replace([np.inf, -np.inf], 0, inplace=True)
    X.fillna(0, inplace=True)

    X_raw = X.copy()

    if not os.path.exists(scaler_path):
        raise FileNotFoundError(f"Scaler file not found: {scaler_path}")

    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)
    X_scaled = scaler.transform(X.values)

    meta_cols = [c for c in df.columns if c.startswith("_")]
    df_meta = df[meta_cols].copy() if meta_cols else pd.DataFrame(index=df.index)

    return X_scaled, X_raw, df_meta


def _encode_category(value: Any, encoder: Any, column: str) -> int:
    """
    Accept either raw category strings or values that are already label-encoded.
    This keeps CSVs exported from the training pipeline from being collapsed into
    the first encoder class.
    """
    classes = list(encoder.classes_)
    proto_map = {
        "1": "icmp",
        "6": "tcp",
        "17": "udp",
        "47": "gre",
        "50": "esp",
        "51": "ah",
        "89": "ospf",
        "132": "sctp",
    }

    if pd.isna(value) or value == "":
        return 0

    text = str(value).strip()

    numeric = pd.to_numeric(text, errors="coerce")
    if not pd.isna(numeric) and float(numeric).is_integer():
        encoded = int(numeric)
        if column == "proto" and text in proto_map:
            category = proto_map[text]
            if category in classes:
                return int(encoder.transform([category])[0])
        if 0 <= encoded < len(classes):
            return encoded

    category = text.lower() if column in {"proto", "service"} else text.upper()
    if category in classes:
        return int(encoder.transform([category])[0])

    logger.debug("Unknown %s category '%s'; using encoder fallback '%s'.", column, value, classes[0])
    return 0
