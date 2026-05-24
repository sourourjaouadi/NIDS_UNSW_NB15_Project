"""
Flask backend for CSV-only network flow analysis.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import time
import uuid
from collections import Counter
from pathlib import Path

from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import joblib
import pandas as pd

try:
    from .explainer import get_explainer
    from .feature_extraction import (
        MODEL_FEATURES,
        parse_csv_to_feature_rows,
        prepare_for_model,
    )
except ImportError:
    from explainer import get_explainer
    from feature_extraction import (
        MODEL_FEATURES,
        parse_csv_to_feature_rows,
        prepare_for_model,
    )


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

MAX_FILE_MB = int(os.getenv("MAX_FILE_MB", 2048))
ALLOWED_EXTENSIONS = {".csv"}

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
BINARY_MODEL_PATH = os.path.join(MODEL_DIR, "rf_binary.pkl")
MULTI_MODEL_PATH = os.path.join(MODEL_DIR, "rf_multiclass_tuned.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_MB * 1024 * 1024

models = {}
_result_store = {}


class ModelLoadError(RuntimeError):
    """Raised when the ML model artifacts are not available for prediction."""


def _attack_classes_from_encoders(encoders: dict) -> list[str]:
    attack_encoder = encoders.get("attack_cat") or encoders.get("attack_only")
    if attack_encoder is None:
        return []
    return [str(label) for label in attack_encoder.classes_ if str(label) != "Normal"]


def load_models():
    try:
        if all(os.path.exists(p) for p in [BINARY_MODEL_PATH, MULTI_MODEL_PATH, SCALER_PATH, ENCODERS_PATH]):
            models["binary"] = joblib.load(BINARY_MODEL_PATH)
            models["multi"] = joblib.load(MULTI_MODEL_PATH)
            models["scaler"] = joblib.load(SCALER_PATH)
            models["encoders"] = joblib.load(ENCODERS_PATH)
            models["attack_classes"] = _attack_classes_from_encoders(models["encoders"])
            get_explainer().load(
                models["binary"],
                models["multi"],
                MODEL_FEATURES,
                models["attack_classes"],
            )
            models["loaded"] = True
            logger.info("All ML models and encoders loaded successfully.")
            logger.info(
                "Using artifacts: binary=%s, multiclass=%s, scaler=%s, encoders=%s",
                BINARY_MODEL_PATH,
                MULTI_MODEL_PATH,
                SCALER_PATH,
                ENCODERS_PATH,
            )
        else:
            models["loaded"] = False
            logger.error("One or more model files are missing. ML prediction is disabled.")
    except Exception as exc:
        models["loaded"] = False
        logger.error("Error loading models: %s. ML prediction is disabled.", exc)


load_models()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


@app.get("/api/predict/demo")
def demo():
    """Return a placeholder demo analysis for frontend initialization."""
    return jsonify({
        "source": "demo_flows.csv",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "packet_count": 1200,
        "flow_count": 1,
        "predictions": [{
            "flow_id": "demo-flow-1",
            "src_ip": "192.168.1.10",
            "dst_ip": "8.8.8.8",
            "src_port": 54321,
            "dst_port": 443,
            "proto": "TCP",
            "service": "HTTPS",
            "first_seen": "2024-03-20 10:00:00",
            "last_seen": "2024-03-20 10:00:05",
            "duration_seconds": 5.0,
            "packet_count": 45,
            "bytes": 5400,
            "risk_score": 0.05,
            "predicted_label": "Normal",
            "attack_family": "Normal",
            "summary": "Typical HTTPS traffic observed.",
            "recommendations": ["No action required."],
            "top_features": [],
        }],
    })


@app.post("/api/analyze/csv")
def analyze_csv():
    if "file" not in request.files:
        return _error(400, "NO_FILE", "No file field in request. Send field name 'file'.")

    uploaded = request.files["file"]
    filename = uploaded.filename or ""

    if filename == "":
        return _error(400, "EMPTY_FILENAME", "File was attached but has no filename.")

    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return _error(400, "BAD_EXTENSION", "Only .csv files are supported.")

    safe_name = Path(filename).name

    try:
        if not models.get("loaded", False):
            raise ModelLoadError(
                "ML models are not loaded. Ensure rf_binary.pkl, rf_multiclass_tuned.pkl, scaler.pkl, and encoders.pkl exist in the models/ directory."
            )

        t_start = time.perf_counter()
        file_bytes = uploaded.read()
        feature_rows = parse_csv_to_feature_rows(file_bytes)

        if not feature_rows:
            return _error(422, "NO_FLOWS", "The CSV did not contain any flow rows.")

        X_scaled, X_raw, df_meta = prepare_for_model(
            feature_rows,
            scaler_path=SCALER_PATH,
            encoders=models.get("encoders"),
        )
        extraction_ms = round((time.perf_counter() - t_start) * 1000, 1)

        session_id = uuid.uuid4().hex
        t_ml_start = time.perf_counter()
        predictions = _run_prediction(X_scaled, X_raw, df_meta, session_id=session_id)
        ml_ms = round((time.perf_counter() - t_ml_start) * 1000, 1)
        attack_counts = Counter(item["attack_family"] for item in predictions)

        raw_chunk = X_raw.iloc[:100] if hasattr(X_raw, "iloc") else X_raw[:100]
        raw_list = [[float(v) for v in row] for row in raw_chunk.values.tolist()]
        scaled_list = [[float(v) for v in row] for row in X_scaled[:100].tolist()]

        logger.info(
            "Finished CSV analysis: Extraction=%sms, ML=%sms, Flows=%s",
            extraction_ms,
            ml_ms,
            len(feature_rows),
        )
        logger.info("Prediction attack family counts: %s", dict(attack_counts))

        return jsonify({
            "source": safe_name,
            "session_id": session_id,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "packet_count": int((X_raw["spkts"] + X_raw["dpkts"]).sum()) if {"spkts", "dpkts"}.issubset(X_raw.columns) else len(feature_rows),
            "flow_count": int(len(feature_rows)),
            "feature_names": MODEL_FEATURES,
            "raw_features": raw_list,
            "scaled_features": scaled_list,
            "predictions": predictions[:100],
            "total_predictions": len(predictions),
            "extraction_ms": extraction_ms,
            "ml_ms": ml_ms,
        })

    except pd.errors.EmptyDataError:
        return _error(400, "EMPTY_CSV", "The uploaded CSV is empty.")

    except ValueError as exc:
        return _error(400, "CSV_ERROR", str(exc))

    except ModelLoadError as exc:
        return _error(500, "MODELS_NOT_LOADED", str(exc))

    except RuntimeError as exc:
        return _error(422, "PREDICTION_ERROR", str(exc))

    except Exception as exc:
        logger.exception("Unexpected error processing '%s'", safe_name)
        return _error(500, "INTERNAL_ERROR", f"{type(exc).__name__}: {exc}")


@app.post("/api/chat/<session_id>/<flow_id>")
def chat(session_id: str, flow_id: str):
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "")).strip()
    history = payload.get("history", [])

    if not message:
        return _error(400, "EMPTY_MESSAGE", "Message is required.")

    flow_entry = _result_store.get(session_id, {}).get(flow_id)
    if flow_entry is None:
        return _error(404, "FLOW_NOT_FOUND", "Flow result was not found for this session.")

    flow_result = flow_entry["prediction"]
    explain_result = flow_entry.get("explain_result")
    if not explain_result or not flow_result.get("shap_top_features"):
        explain_result = get_explainer().explain_flow(
            flow_entry["X_row_df"],
            flow_entry.get("predicted_class_idx", 0),
        )
        flow_entry["explain_result"] = explain_result
        flow_result["shap_top_features"] = explain_result["top_10"]

    context = get_explainer().build_chat_context(flow_result, explain_result)
    system_prompt = _build_chat_system_prompt(context)
    messages = [
        {"role": item.get("role"), "content": item.get("content", "")}
        for item in history
        if item.get("role") in {"user", "assistant"}
    ]
    messages.append({"role": "user", "content": message})

    return Response(
        _stream_groq_response(system_prompt, messages),
        mimetype="text/event-stream",
    )


def _run_prediction(X_scaled, X_raw, df_meta, session_id: str | None = None) -> list[dict]:
    """Convert model outputs and feature rows to the structure expected by the frontend."""
    predictions = []
    meta_records = df_meta.to_dict(orient="records")
    binary_model = models.get("binary")
    multi_model = models.get("multi")
    encoders = models.get("encoders", {})
    le_attack = encoders.get("attack_cat") or encoders.get("attack_only")

    if not binary_model or not multi_model:
        raise RuntimeError("ML models are not loaded. Prediction requires rf_binary.pkl and rf_multiclass_tuned.pkl.")

    for i in range(len(X_scaled)):
        meta = meta_records[i] if i < len(meta_records) else {}
        raw_row = X_raw.iloc[i] if hasattr(X_raw, "iloc") else X_raw[i]
        feat_row = X_scaled[i].reshape(1, -1)
        prob = binary_model.predict_proba(feat_row)[0][1]
        risk_score = float(prob)
        label = "Attack" if risk_score > 0.5 else "Normal"

        if label == "Attack":
            attack_idx = multi_model.predict(feat_row)[0]
            attack_family = _decode_attack_family(le_attack, attack_idx)
        else:
            attack_idx = None
            attack_family = "Normal"

        start_time = float(meta.get("_start_time", 0) or 0)
        duration = _raw_value(raw_row, "dur", meta.get("_duration_s", 0))
        proto_value = _decode_feature_value("proto", _raw_value(raw_row, "proto", meta.get("_protocol", "")))
        service_value = _decode_feature_value("service", _raw_value(raw_row, "service", "-"))
        proto_name = _format_proto(proto_value)
        src_port = int(_raw_value(raw_row, "sport", meta.get("_src_port", 0)))
        dst_port = int(_raw_value(raw_row, "dsport", meta.get("_dst_port", 0)))
        service = str(service_value).upper()

        flow_result = {
            "flow_id": f"flow-{i}-{uuid.uuid4().hex[:6]}",
            "src_ip": meta.get("_src_ip", ""),
            "dst_ip": meta.get("_dst_ip", ""),
            "src_port": src_port,
            "dst_port": dst_port,
            "proto": proto_name,
            "service": service if service not in {"", "NONE", "0.0"} else "-",
            "first_seen": datetime.datetime.fromtimestamp(start_time).strftime("%Y-%m-%d %H:%M:%S"),
            "last_seen": datetime.datetime.fromtimestamp(start_time + float(duration)).strftime("%Y-%m-%d %H:%M:%S"),
            "duration_seconds": round(float(duration), 4),
            "packet_count": int(_raw_value(raw_row, "spkts", 0) + _raw_value(raw_row, "dpkts", 0)),
            "bytes": int(_raw_value(raw_row, "sbytes", 0) + _raw_value(raw_row, "dbytes", 0)),
            "risk_score": round(risk_score, 2),
            "predicted_label": label,
            "attack_family": attack_family,
            "summary": f"Observed {proto_name} flow predicted as {label}.",
            "recommendations": ["No immediate action required."] if label == "Normal" else [
                "Monitor this source for further activity.",
                "Isolate host if behavior persists.",
            ],
            "top_features": [],
            "shap_top_features": [],
        }

        X_row_df = pd.DataFrame([X_scaled[i]], columns=MODEL_FEATURES)
        explain_result = None
        if label == "Attack" and attack_idx is not None:
            explain_result = get_explainer().explain_flow(X_row_df, attack_idx)
            flow_result["shap_top_features"] = explain_result["top_10"]
            flow_result["top_features"] = _to_legacy_feature_drivers(explain_result["top_10"])

        predictions.append(flow_result)

        if session_id is not None:
            _result_store.setdefault(session_id, {})[flow_result["flow_id"]] = {
                "prediction": flow_result,
                "X_row_df": X_row_df,
                "predicted_class_idx": int(attack_idx) if attack_idx is not None else 0,
                "explain_result": explain_result,
            }

    return predictions


def _to_legacy_feature_drivers(shap_features: list[dict]) -> list[dict]:
    return [
        {
            "name": item["feature"],
            "raw_value": str(item["feature_value"]),
            "impact": min(1.0, float(item["abs_impact"])),
            "plain_english": item["semantic"],
        }
        for item in shap_features[:5]
    ]


def _build_chat_system_prompt(context: dict) -> str:
    toward_attack = "\n".join(
        f"  - {item['feature']} = {item['feature_value']} (impact: +{item['shap_value']}) — {item['semantic']}"
        for item in context["top_features"]
        if item["direction"] == "toward_attack"
    ) or "  - None"
    toward_normal = "\n".join(
        f"  - {item['feature']} = {item['feature_value']} (impact: {item['shap_value']}) — {item['semantic']}"
        for item in context["top_features"]
        if item["direction"] == "toward_normal"
    ) or "  - None"

    flow_id = context["flow_id"]
    attack_type = context["attack_type"]
    attack_probability = context["attack_probability"]
    confidence = context["confidence"]
    attack_signature = context["attack_signature"]
    base_value = context["base_value"]

    return f"""You are a cybersecurity AI assistant embedded in a real-time SOC (Security Operations Center) dashboard.
Your role is to explain network intrusion detection decisions to security analysts in plain English.
You are precise, concise, and always ground your explanations in the actual data shown below.
Never invent numbers, features, or probabilities that are not in the data below.

--- CURRENT ALERT ---
Flow ID: {flow_id}
Verdict: {attack_type}
Attack probability: {attack_probability}%
Model confidence: {confidence}%
Attack description: {attack_signature}

--- EVIDENCE (SHAP feature contributions) ---
Features that pushed the model toward ATTACK:
{toward_attack}

Features that pushed the model toward NORMAL:
{toward_normal}

Model base rate (prior probability before seeing this flow): {base_value}

--- YOUR BEHAVIOR ---
- When asked to explain the alert: give a 3-5 sentence plain-English explanation connecting the top features to the attack type.
- When asked for a report paragraph: write formal technical prose suitable for a security incident report.
- When asked what to do: give concrete Tier-1 SOC response steps appropriate to the attack type.
- When asked if it could be a false positive: analyze the evidence honestly and give a probability estimate with reasoning.
- For any follow-up question: answer using only the data above, never make up additional evidence.
- Keep responses under 200 words unless the analyst asks for a report paragraph.
"""


def _stream_groq_response(system_prompt: str, messages: list[dict]):
    try:
        if not os.getenv("GROQ_API_KEY"):
            raise RuntimeError(
                "GROQ_API_KEY is not set. Set it in the same terminal before starting the backend."
            )

        from groq import Groq

        client = Groq()
        stream = client.chat.completions.create(
            model=GROQ_CHAT_MODEL,
            max_tokens=600,
            messages=[{"role": "system", "content": system_prompt}, *messages],
            stream=True,
        )
        for chunk in stream:
            choices = getattr(chunk, "choices", [])
            if not choices:
                continue

            delta = getattr(choices[0], "delta", None)
            text = getattr(delta, "content", "") if delta else ""
            if text:
                yield f"data: {json.dumps({'text': text})}\n\n"
    except Exception as exc:
        logger.exception("Groq chat streaming failed.")
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    yield 'data: {"done": true}\n\n'


def _raw_value(row, key: str, default=0):
    if hasattr(row, "get"):
        value = row.get(key, default)
    else:
        value = default

    try:
        if pd.isna(value):
            return default
    except TypeError:
        pass

    return value


def _decode_feature_value(feature: str, value):
    encoder = models.get("encoders", {}).get(feature)
    if encoder is None:
        return value

    try:
        index = int(value)
        if 0 <= index < len(encoder.classes_):
            return encoder.inverse_transform([index])[0]
    except Exception:
        return value

    return value


def _decode_attack_family(encoder, attack_idx) -> str:
    if encoder is None:
        return f"Category {attack_idx}"

    index = int(attack_idx)
    classes = list(encoder.classes_)

    if "Normal" in classes and len(classes) == 10:
        attack_classes = [label for label in classes if label != "Normal"]
        if 0 <= index < len(attack_classes):
            return str(attack_classes[index])

    if 0 <= index < len(classes):
        return str(encoder.inverse_transform([index])[0])

    return f"Category {attack_idx}"


def _format_proto(value) -> str:
    proto_map = {
        1: "ICMP",
        6: "TCP",
        17: "UDP",
        "1": "ICMP",
        "6": "TCP",
        "17": "UDP",
        "icmp": "ICMP",
        "tcp": "TCP",
        "udp": "UDP",
    }
    return proto_map.get(value, str(value).upper() if str(value) else "UNK")


def _error(http_code: int, code: str, message: str):
    logger.warning("[%s] %s: %s", http_code, code, message)
    return jsonify({
        "status": "error",
        "code": code,
        "message": message,
    }), http_code


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("DEBUG", "false").lower() == "true",
    )
