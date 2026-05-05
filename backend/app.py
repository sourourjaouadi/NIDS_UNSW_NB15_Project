"""
Flask backend â€” receives PCAP uploads, runs feature extraction,
and returns the feature matrix + metadata as JSON.
"""

import os
import time
import uuid
import logging
import datetime
import tempfile
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

import joblib
import pandas as pd
import numpy as np

try:
    from .feature_extraction import extract_features_from_pcap, MODEL_FEATURES
except ImportError:
    from feature_extraction import extract_features_from_pcap, MODEL_FEATURES

# â”€â”€ Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s â€” %(message)s",
)
logger = logging.getLogger(__name__)

# â”€â”€ App factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "*"}})   # tighten in production

# â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
MAX_FILE_MB        = int(os.getenv("MAX_FILE_MB", 2048))
ALLOWED_EXTENSIONS = {".pcap", ".pcapng"}
FLOW_TIMEOUT       = float(os.getenv("FLOW_TIMEOUT", 120.0))

# Model Paths - use parent directory since models/ is at project root
MODEL_DIR          = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
BINARY_MODEL_PATH  = os.path.join(MODEL_DIR, "rf_binary.pkl")
MULTI_MODEL_PATH   = os.path.join(MODEL_DIR, "rf_multiclass.pkl")
SCALER_PATH        = os.path.join(MODEL_DIR, "scaler.pkl")
ENCODERS_PATH      = os.path.join(MODEL_DIR, "encoders.pkl")
# ── XGB DUAL MODEL START ──
XGB_BINARY_MODEL_PATH = os.path.join(MODEL_DIR, "xgb_bin_tuned.pkl")
XGB_MULTI_MODEL_PATH  = os.path.join(MODEL_DIR, "xgb_multi_tuned.pkl")
# ── XGB DUAL MODEL END ──

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_MB * 1024 * 1024

# â”€â”€ Global Model Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
models = {}
sessions = {}

def load_models():
    try:
        if all(os.path.exists(p) for p in [BINARY_MODEL_PATH, MULTI_MODEL_PATH, SCALER_PATH, ENCODERS_PATH]):
            models['rf_binary_model'] = joblib.load(BINARY_MODEL_PATH)
            models['rf_multiclass_model'] = joblib.load(MULTI_MODEL_PATH)
            models['scaler'] = joblib.load(SCALER_PATH)
            models['encoders'] = joblib.load(ENCODERS_PATH)
            models['binary'] = models['rf_binary_model']
            models['multi'] = models['rf_multiclass_model']
            # ── XGB DUAL MODEL START ──
            if all(os.path.exists(p) for p in [XGB_BINARY_MODEL_PATH, XGB_MULTI_MODEL_PATH]):
                try:
                    models['xgb_binary_model'] = joblib.load(XGB_BINARY_MODEL_PATH)
                    models['xgb_multi_model'] = joblib.load(XGB_MULTI_MODEL_PATH)
                    logger.info("RF, XGBoost, shared scaler, and encoders loaded successfully.")
                except Exception as e:
                    logger.error(f"Error loading XGBoost models: {e}. RF inference remains available.")
            else:
                logger.warning("XGBoost model files are missing. RF inference remains available.")
            # ── XGB DUAL MODEL END ──
        else:
            logger.warning("One or more model files are missing. Running in MOCK mode.")
    except Exception as e:
        logger.error(f"Error loading models: {e}. Running in MOCK mode.")

load_models()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  ROUTES
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


@app.get("/api/predict/demo")
def demo():
    """Return a placeholder demo analysis for frontend initialization."""
    return jsonify({
        "session_id": "demo",
        "source": "demo_capture.pcap",
        "generated_at": time.strftime('%Y-%m-%d %H:%M:%S'),
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
            "predicted_label": "Benign",
            "attack_family": "Normal",
            "binary_prediction": "Normal",
            "binary_confidence": 0.95,
            "multiclass_prediction": "Normal",
            "multiclass_confidence": None,
            "rf": {
                "binary_prediction": "Normal",
                "binary_confidence": 0.95,
                "multiclass_prediction": "Normal",
                "multiclass_confidence": None
            },
            "xgb": {
                "binary_prediction": "Normal",
                "binary_confidence": 0.94,
                "multiclass_prediction": "Normal",
                "multiclass_confidence": None
            },
            "models_agree": True,
            "summary": "Typical HTTPS traffic observed.",
            "recommendations": ["No action required."],
            "top_features": []
        }]
    })


@app.post("/api/predict/upload")
def analyze():
    """
    POST /api/predict/upload
    Content-Type: multipart/form-data
    Body field: file  (.pcap or .pcapng)

    Returns JSON:
    {
      "status": "success",
      "filename": "capture.pcap",
      "summary": { total_packets, total_flows, feature_count, processing_ms },
      "flows": [ { src_ip, dst_ip, src_port, dst_port, protocol }, ... ],
      "features": [[...], [...], ...]   â† shape (N_flows Ã— N_features)
    }
    """

    # â”€â”€ 1. File presence check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if "file" not in request.files:
        return _error(400, "NO_FILE", "No file field in request. Send field name 'file'.")

    uploaded = request.files["file"]

    if uploaded.filename == "":
        return _error(400, "EMPTY_FILENAME", "File was attached but has no filename.")

    # â”€â”€ 2. Extension check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return _error(
            400, "BAD_EXTENSION",
            f"'{suffix}' is not supported. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    # â”€â”€ 3. Save to temp file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    safe_name = secure_filename(uploaded.filename)
    tmp_path  = os.path.join(
        tempfile.gettempdir(),
        f"pcap_{uuid.uuid4().hex}_{safe_name}"
    )

    try:
        uploaded.save(tmp_path)
        logger.info(f"Saved '{safe_name}' â†’ {tmp_path} "
                    f"({os.path.getsize(tmp_path) / 1024:.1f} KB)")

        # â”€â”€ 4. Run the pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        X_scaled, X_raw, df_meta, summary = extract_features_from_pcap(
            filepath=tmp_path,
            scaler_path=SCALER_PATH,
            flow_timeout=FLOW_TIMEOUT,
            encoders=models.get('encoders'),
        )

        # â”€â”€ 5. Prepare Response (Truncate for performance if too large) â”€â”€â”€â”€
        t_ml_start = time.perf_counter()
        predictions = _features_to_predictions(X_scaled, X_raw, df_meta)
        ml_ms = round((time.perf_counter() - t_ml_start) * 1000, 1)
        session_id = uuid.uuid4().hex

        logger.info(f"Finished: Extraction={summary['processing_ms']}ms, ML={ml_ms}ms, Flows={summary['total_flows']}")

        # Cast to regular python types to ensure JSON serializability
        raw_list = []
        scaled_list = []
        if len(X_raw) > 0:
            # Take first 100 rows
            chunk_raw = X_raw.iloc[:100] if hasattr(X_raw, 'iloc') else X_raw[:100]
            chunk_scaled = X_scaled[:100]
            
            # Convert to list of lists, ensuring native types
            if hasattr(chunk_raw, 'values'):
                raw_list = [[float(v) for v in row] for row in chunk_raw.values.tolist()]
            else:
                raw_list = [[float(v) for v in row] for row in chunk_raw.tolist()]
            
            scaled_list = [[float(v) for v in row] for row in chunk_scaled.tolist()] if hasattr(chunk_scaled, 'tolist') else chunk_scaled.tolist()

        response_payload = {
            "session_id":    session_id,
            "source":       safe_name,
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S'),
            "packet_count": int(summary["total_packets"]),
            "flow_count":   int(summary["total_flows"]),
            "feature_names": summary.get("feature_names", MODEL_FEATURES),
            "raw_features": raw_list,
            "scaled_features": scaled_list,
            "predictions":  predictions[:100], 
            "total_predictions": len(predictions),
            "extraction_ms": summary["processing_ms"],
            "ml_ms": ml_ms
        }

        sessions[session_id] = {
            **response_payload,
            "x_scaled": X_scaled[:100],
        }

        return jsonify(response_payload)

    except FileNotFoundError as e:
        return _error(400, "FILE_NOT_FOUND", str(e))

    except ValueError as e:
        # parse_pcap raised: empty file, no IP packets, corrupt header
        return _error(400, "PARSE_ERROR", str(e))

    except RuntimeError as e:
        # No flows produced after aggregation
        return _error(422, "NO_FLOWS", str(e))

    except Exception as e:
        logger.exception(f"Unexpected error processing '{safe_name}'")
        return _error(500, "INTERNAL_ERROR", f"{type(e).__name__}: {e}")

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            logger.info(f"Cleaned up {tmp_path}")


@app.get("/api/results/<session_id>")
@app.get("/results/<session_id>")
def session_results(session_id):
    session = sessions.get(session_id)
    if not session:
        return _error(404, "SESSION_NOT_FOUND", f"No results found for session '{session_id}'.")

    return jsonify({
        key: value
        for key, value in session.items()
        if key not in {"x_scaled"}
    })


@app.get("/api/explain/<session_id>/<int:flow_index>")
@app.get("/explain/<session_id>/<int:flow_index>")
def explain_flow(session_id, flow_index):
    # ── XGB DUAL MODEL START ──
    selected_model = request.args.get("model", "rf").lower()
    if selected_model not in {"rf", "xgb"}:
        return _error(400, "BAD_MODEL", "Query parameter 'model' must be 'rf' or 'xgb'.")

    session = sessions.get(session_id)
    if not session:
        return _error(404, "SESSION_NOT_FOUND", f"No results found for session '{session_id}'.")

    x_scaled = session.get("x_scaled")
    if x_scaled is None or flow_index < 0 or flow_index >= len(x_scaled):
        return _error(404, "FLOW_NOT_FOUND", f"No flow index {flow_index} found for session '{session_id}'.")

    model_key = "rf_binary_model" if selected_model == "rf" else "xgb_binary_model"
    binary_model = models.get(model_key)
    if binary_model is None:
        return _error(503, "MODEL_UNAVAILABLE", f"{selected_model.upper()} binary model is unavailable.")

    try:
        import shap

        row = np.asarray(x_scaled[flow_index]).reshape(1, -1)
        explainer = shap.TreeExplainer(binary_model)
        shap_values = explainer.shap_values(row)
        base_value = explainer.expected_value

        values = shap_values[-1][0] if isinstance(shap_values, list) else shap_values[0]
        base = np.asarray(base_value).reshape(-1)[-1] if isinstance(base_value, (list, np.ndarray)) else base_value

        return jsonify({
            "model": selected_model,
            "shap_values": [float(v) for v in np.asarray(values).reshape(-1)],
            "base_value": float(base),
        })
    except ImportError:
        return _error(503, "SHAP_UNAVAILABLE", "SHAP is not installed in this environment.")
    except Exception as e:
        logger.exception("SHAP explanation failed")
        return _error(500, "EXPLAIN_ERROR", f"{type(e).__name__}: {e}")
    # ── XGB DUAL MODEL END ──


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  HELPERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _attack_encoder():
    encoders = models.get("encoders", {})
    if hasattr(encoders, "inverse_transform"):
        return encoders
    if isinstance(encoders, dict):
        return encoders.get("attack_only") or encoders.get("attack_cat")
    return None


def _decode_attack_label(value):
    # ── INFERENCE FIX START ──
    le_attack = _attack_encoder()
    if isinstance(value, str):
        return value
    if le_attack:
        try:
            return str(le_attack.inverse_transform([int(value)])[0])
        except Exception:
            logger.warning("Could not decode attack label %s", value)
    # ── INFERENCE FIX END ──
    return f"Category {value}"


def _jsonable_features(row):
    values = row.to_dict() if hasattr(row, "to_dict") else {}
    return {
        str(key): (None if pd.isna(value) else float(value))
        for key, value in values.items()
    }


def _model_confidence(model, feat_row, predicted_value=None):
    if not hasattr(model, "predict_proba"):
        return 1.0

    probs = model.predict_proba(feat_row)[0]
    if predicted_value is not None and hasattr(model, "classes_"):
        class_list = list(model.classes_)
        if predicted_value in class_list:
            return float(probs[class_list.index(predicted_value)])
    return float(np.max(probs))


def _run_model_pipeline(binary_model, multi_model, feat_row):
    # ── INFERENCE FIX START ──
    binary_raw = binary_model.predict(feat_row)[0]
    binary_confidence = _model_confidence(binary_model, feat_row, binary_raw)
    try:
        is_attack = int(binary_raw) == 1
    except (TypeError, ValueError):
        is_attack = str(binary_raw).lower() in {"attack", "attacks", "malicious", "suspicious", "true"}

    result = {
        "binary_prediction": "Attack" if is_attack else "Normal",
        "binary_confidence": round(binary_confidence, 4),
        "multiclass_prediction": None,
        "multiclass_confidence": None,
    }

    if is_attack and multi_model:
        multi_raw = multi_model.predict(feat_row)[0]
        result["multiclass_prediction"] = _decode_attack_label(multi_raw)
        if hasattr(multi_model, "predict_proba"):
            result["multiclass_confidence"] = round(float(multi_model.predict_proba(feat_row).max()), 4)
        else:
            result["multiclass_confidence"] = 1.0

    # ── INFERENCE FIX END ──
    return result


def _features_to_predictions(X_scaled, X_raw, df_meta) -> list[dict]:
    """Convert the model output and metadata to the structure expected by the frontend."""
    import random

    predictions = []
    meta_records = df_meta.to_dict(orient="records")
    proto_map = {1: "ICMP", 6: "TCP", 17: "UDP"}

    rf_binary_model = models.get("rf_binary_model") or models.get("binary")
    rf_multiclass_model = models.get("rf_multiclass_model") or models.get("multi")
    # ── XGB DUAL MODEL START ──
    xgb_binary_model = models.get("xgb_binary_model")
    xgb_multi_model = models.get("xgb_multi_model")
    # ── XGB DUAL MODEL END ──

    # ── INFERENCE FIX START ──
    print(f"\n[DIAGNOSTIC] Feature shape: {X_scaled.shape}")
    print(f"[DIAGNOSTIC] Feature Columns Order: {MODEL_FEATURES}")
    
    # Print encoder classes
    le_attack = _attack_encoder()
    if le_attack and hasattr(le_attack, "classes_"):
        print(f"[DIAGNOSTIC] Encoder Classes: {list(le_attack.classes_)}")

    if len(X_scaled) > 0:
        i = 0 # Look at first flow
        raw_v = X_raw.iloc[i] if hasattr(X_raw, 'iloc') else X_raw[i]
        scaled_v = X_scaled[i]
        
        print(f"\n[DIAGNOSTIC] Flow {i} Features:")
        print(f"  BEFORE scaling (Raw/Encoded): {list(raw_v)}")
        print(f"  AFTER scaling: {list(scaled_v)}")
        
        feat_row = scaled_v.reshape(1, -1)
        if rf_binary_model and hasattr(rf_binary_model, "predict_proba"):
            print(f"  Binary Model Probabilities: {rf_binary_model.predict_proba(feat_row)[0]}")
        if rf_multiclass_model and hasattr(rf_multiclass_model, "predict_proba"):
            print(f"  Multiclass Model Probabilities: {rf_multiclass_model.predict_proba(feat_row)[0]}")
            print(f"  Multiclass Model Classes: {rf_multiclass_model.classes_}")
    # ── INFERENCE FIX END ──

    for i, meta in enumerate(meta_records):
        raw_row = X_raw.iloc[i] if hasattr(X_raw, "iloc") else X_raw[i]
        feat_row = X_scaled[i].reshape(1, -1)

        if rf_binary_model:
            rf_result = _run_model_pipeline(rf_binary_model, rf_multiclass_model, feat_row)
            risk_score = rf_result["binary_confidence"]
            label = "Suspicious" if rf_result["binary_prediction"] == "Attack" else "Benign"
            attack_family = rf_result["multiclass_prediction"]
        else:
            risk_score = random.uniform(0.01, 0.15)
            label = "Benign"
            if meta.get("sload", 0) > 1000000:
                risk_score = random.uniform(0.4, 0.7)
                label = "Suspicious"
            attack_family = "Normal" if label == "Benign" else "Unknown"
            rf_result = {
                "binary_prediction": "Attack" if label != "Benign" else "Normal",
                "binary_confidence": round(float(risk_score), 4),
                "multiclass_prediction": attack_family,
                "multiclass_confidence": None,
            }

        # ── XGB DUAL MODEL START ──
        xgb_result = None
        if xgb_binary_model:
            xgb_result = _run_model_pipeline(xgb_binary_model, xgb_multi_model, feat_row)
        models_agree = (
            xgb_result is not None
            and rf_result["binary_prediction"] == xgb_result["binary_prediction"]
            and (
                rf_result["binary_prediction"] == "Normal"
                or rf_result["multiclass_prediction"] == xgb_result["multiclass_prediction"]
            )
        )
        # ── XGB DUAL MODEL END ──

        start_time = meta.get("_start_time", 0)
        duration = meta.get("_duration_s", 0)

        proto_num = int(meta.get("_protocol", 0))
        proto_name = proto_map.get(proto_num, str(proto_num))
        features = _jsonable_features(raw_row)

        predictions.append({
            "flow_index":   i,
            "features":     features,
            "flow_id":      f"flow-{i}-{uuid.uuid4().hex[:6]}",
            "src_ip":       meta.get("_src_ip", ""),
            "dst_ip":       meta.get("_dst_ip", ""),
            "src_port":     int(meta.get("_src_port", 0)),
            "dst_port":     int(meta.get("_dst_port", 0)),
            "proto":        proto_name,
            "service":      "HTTP" if meta.get("_dst_port") == 80 else "HTTPS" if meta.get("_dst_port") == 443 else "DNS" if meta.get("_dst_port") == 53 else "-",
            "first_seen":   datetime.datetime.fromtimestamp(start_time).strftime('%Y-%m-%d %H:%M:%S'),
            "last_seen":    datetime.datetime.fromtimestamp(start_time + duration).strftime('%Y-%m-%d %H:%M:%S'),
            "duration_seconds": round(float(duration), 4),
            "packet_count": int((raw_row.get("spkts", 0) if hasattr(raw_row, "get") else 0) + (raw_row.get("dpkts", 0) if hasattr(raw_row, "get") else 0)),
            "bytes":        int((raw_row.get("sbytes", 0) if hasattr(raw_row, "get") else 0) + (raw_row.get("dbytes", 0) if hasattr(raw_row, "get") else 0)),
            "risk_score":   round(float(risk_score), 2),
            "predicted_label": label,
            "attack_family": attack_family,
            "binary_prediction": rf_result["binary_prediction"],
            "binary_confidence": rf_result["binary_confidence"],
            "multiclass_prediction": rf_result["multiclass_prediction"],
            "multiclass_confidence": rf_result["multiclass_confidence"],
            "rf": rf_result,
            # ── XGB DUAL MODEL START ──
            "xgb": xgb_result,
            "models_agree": models_agree,
            # ── XGB DUAL MODEL END ──
            "summary":      f"Observed {proto_name} flow from {meta.get('_src_ip')} to {meta.get('_dst_ip')}. Predicted as {label}.",
            "recommendations": ["No immediate action required."] if label == "Benign" else ["Monitor this source IP for further activity.", "Isolate host if behavior persists."],
            "top_features": []
        })
    return predictions


def _error(http_code: int, code: str, message: str):
    """Return a consistent JSON error response."""
    logger.warning(f"[{http_code}] {code}: {message}")
    return jsonify({
        "status":  "error",
        "code":    code,
        "message": message,
    }), http_code


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
#  ENTRY POINT
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("DEBUG", "false").lower() == "true",
    )
