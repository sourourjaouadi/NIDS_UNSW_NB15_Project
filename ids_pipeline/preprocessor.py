from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable

try:
    from ids_pipeline.config import (
        CATEGORICAL_ENCODINGS,
        FEATURE_COLUMNS,
        LOG_SCALE_COLUMNS,
        NUMERIC_DEFAULTS,
    )
except ImportError:  # pragma: no cover
    from config import CATEGORICAL_ENCODINGS, FEATURE_COLUMNS, LOG_SCALE_COLUMNS, NUMERIC_DEFAULTS


@dataclass
class ProcessedBatch:
    rows: list[dict[str, object]]
    feature_names: list[str]
    matrix: list[list[float]]


def _coerce_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _encode_feature(group: str, raw_value: object, fallback: str) -> int:
    normalized = str(raw_value or fallback).lower()
    return CATEGORICAL_ENCODINGS[group].get(normalized, CATEGORICAL_ENCODINGS[group][fallback])


def clean_feature_row(row: dict[str, object]) -> dict[str, object]:
    cleaned = dict(row)

    for key, default in NUMERIC_DEFAULTS.items():
        cleaned[key] = _coerce_float(cleaned.get(key), default)

    cleaned["proto"] = str(cleaned.get("proto", "other")).lower()
    cleaned["service"] = str(cleaned.get("service", "unknown")).lower()
    cleaned["state"] = str(cleaned.get("state", "other")).lower()

    cleaned["proto_enc"] = _encode_feature("proto", cleaned["proto"], "other")
    cleaned["service_enc"] = _encode_feature("service", cleaned["service"], "unknown")
    cleaned["state_enc"] = _encode_feature("state", cleaned["state"], "other")

    for key in LOG_SCALE_COLUMNS:
        cleaned[key] = round(math.log1p(max(_coerce_float(cleaned[key]), 0.0)), 6)

    return cleaned


def preprocess_rows(rows: Iterable[dict[str, object]]) -> ProcessedBatch:
    cleaned_rows = [clean_feature_row(row) for row in rows]
    matrix = [
        [_coerce_float(cleaned_row.get(feature)) for feature in FEATURE_COLUMNS]
        for cleaned_row in cleaned_rows
    ]
    return ProcessedBatch(rows=cleaned_rows, feature_names=list(FEATURE_COLUMNS), matrix=matrix)

