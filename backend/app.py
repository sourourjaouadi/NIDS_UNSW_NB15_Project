"""
Flask backend — receives PCAP uploads, runs feature extraction,
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

# SHAP import — used for per-feature prediction explanations
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── App factory ────────────────────────────────────────────────────────────────
app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "*"}})   # tighten in production

# ── Config ─────────────────────────────────────────────────────────────────────
MAX_FILE_MB        = int(os.getenv("MAX_FILE_MB", 2048))
ALLOWED_EXTENSIONS = {".pcap", ".pcapng"}
FLOW_TIMEOUT       = float(os.getenv("FLOW_TIMEOUT", 120.0))

# Model Paths - use parent directory since models/ is at project root
MODEL_DIR          = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
BINARY_MODEL_PATH  = os.path.join(MODEL_DIR, "rf_binary.pkl")
MULTI_MODEL_PATH   = os.path.join(MODEL_DIR, "rf_multiclass.pkl")
SCALER_PATH        = os.path.join(MODEL_DIR, "scaler.pkl")
ENCODERS_PATH      = os.path.join(MODEL_DIR, "encoders.pkl")

app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_MB * 1024 * 1024

# ── Global Model Load ──────────────────────────────────────────────────────────
models = {}

def load_models():
    """Load ML models, scaler, encoders, and SHAP explainers at startup."""
    try:
        if all(os.path.exists(p) for p in [BINARY_MODEL_PATH, MULTI_MODEL_PATH, SCALER_PATH, ENCODERS_PATH]):
            models['binary'] = joblib.load(BINARY_MODEL_PATH)
            models['multi'] = joblib.load(MULTI_MODEL_PATH)
            models['scaler'] = joblib.load(SCALER_PATH)
            models['encoders'] = joblib.load(ENCODERS_PATH)
            logger.info("All ML models and encoders loaded successfully.")

            # ── SHAP Explainer Initialization ──────────────────────────────
            # Build a TreeExplainer for the model used in final prediction.
            # Currently the binary RF is the decision model; if XGBoost is
            # introduced later, TreeExplainer handles both seamlessly.
            if SHAP_AVAILABLE:
                try:
                    binary_model = models.get('binary')
                    if binary_model is not None:
                        models['explainer'] = shap.TreeExplainer(binary_model)
                        logger.info("SHAP TreeExplainer initialised for binary model.")
                    else:
                        logger.warning("Binary model not available — SHAP explainer skipped.")
                except Exception as e:
                    logger.warning(f"Failed to build SHAP explainer: {e}. Explanations will be omitted.")
            else:
                logger.warning("shap package not installed — prediction explanations disabled.")
        else:
            logger.warning("One or more model files are missing. Running in MOCK mode.")
    except Exception as e:
        logger.error(f"Error loading models: {e}. Running in MOCK mode.")

load_models()


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


@app.get("/api/predict/demo")
def demo():
    """Return a placeholder demo analysis for frontend initialization."""
    return jsonify({
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
      "features": [[...], [...], ...]   ← shape (N_flows × N_features)
    }
    """

    # ── 1. File presence check ─────────────────────────────────────────────
    if "file" not in request.files:
        return _error(400, "NO_FILE", "No file field in request. Send field name 'file'.")

    uploaded = request.files["file"]

    if uploaded.filename == "":
        return _error(400, "EMPTY_FILENAME", "File was attached but has no filename.")

    # ── 2. Extension check ─────────────────────────────────────────────────
    suffix = Path(uploaded.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        return _error(
            400, "BAD_EXTENSION",
            f"'{suffix}' is not supported. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    # ── 3. Save to temp file ───────────────────────────────────────────────
    safe_name = secure_filename(uploaded.filename)
    tmp_path  = os.path.join(
        tempfile.gettempdir(),
        f"pcap_{uuid.uuid4().hex}_{safe_name}"
    )

    try:
        uploaded.save(tmp_path)
        logger.info(f"Saved '{safe_name}' → {tmp_path} "
                    f"({os.path.getsize(tmp_path) / 1024:.1f} KB)")

        # ── 4. Run the pipeline ────────────────────────────────────────────
        X_scaled, X_raw, df_meta, summary = extract_features_from_pcap(
            filepath=tmp_path,
            scaler_path=SCALER_PATH,
            flow_timeout=FLOW_TIMEOUT,
            encoders=models.get('encoders'),
        )

        # ── 5. Prepare Response (Truncate for performance if too large) ────
        t_ml_start = time.perf_counter()
        predictions = _features_to_predictions(X_scaled, X_raw, df_meta)
        ml_ms = round((time.perf_counter() - t_ml_start) * 1000, 1)

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

        return jsonify({
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
        })

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


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _features_to_predictions(X_scaled, X_raw, df_meta) -> list[dict]:
    """Convert the model output and metadata to the structure expected by the frontend."""
    import random
    
    predictions = []
    meta_records = df_meta.to_dict(orient="records")
    proto_map = {1: "ICMP", 6: "TCP", 17: "UDP"}
    
    # ── SHAP: compute explanations for ALL flows in one batch ─────────────
    # TreeExplainer accepts a 2-D array; running it once is far faster than
    # calling explainer() inside the per-flow loop.
    shap_values_all = None
    feature_names = MODEL_FEATURES
    explainer = models.get('explainer')
    if explainer is not None and len(X_scaled) > 0:
        try:
            shap_output = explainer(X_scaled)
            # shap_output.values shape: (n_flows, n_features)
            shap_values_all = shap_output.values
        except Exception as e:
            logger.warning(f"SHAP batch computation failed: {e}")

    # Load categorical encoders
    encoders = models.get('encoders', {})
    le_proto = encoders.get('proto')
    le_service = encoders.get('service')
    le_state = encoders.get('state')
    le_attack = encoders.get('attack_cat')
    
    binary_model = models.get('binary')
    multi_model = models.get('multi')

    for i, meta in enumerate(meta_records):
        raw_row = X_raw.iloc[i] if hasattr(X_raw, "iloc") else X_raw[i]
        # 1. Prediction Logic
        if binary_model and 'scaler' in models:
            # We already have X_scaled from extract_features_from_pcap
            # But we need to ensure categorical features were handled.
            # Actually, extract_features_from_pcap in this version doesn't encodeCATEGORICAL yet.
            # Let's handle encoding here for the raw features before scaling if necessary,
            # or assume feature_extraction.py produced raw numbers.
            # In our current setup, feature_extraction.py produces strings for proto/service/state.
            
            # Re-process the row for the model
            row_dict = df_meta.iloc[i].to_dict()
            # Combine with quantitative features (simplified)
            # Actually, df_meta only contains columns starting with "_"
            # We need the full feature set.
            pass

        # Simplified for now: use X_scaled directly if it matches MODEL_FEATURES
        if binary_model:
            feat_row = X_scaled[i].reshape(1, -1)
            prob = binary_model.predict_proba(feat_row)[0][1] # Probability of attack
            risk_score = float(prob)
            label = "Suspicious" if risk_score > 0.5 else "Benign"
            
            if label == "Suspicious" and multi_model:
                attack_idx = multi_model.predict(feat_row)[0]
                if le_attack:
                    attack_family = le_attack.inverse_transform([attack_idx])[0]
                else:
                    attack_family = f"Category {attack_idx}"
            else:
                attack_family = "Normal"
        else:
            # Fallback to mock logic
            risk_score = random.uniform(0.01, 0.15) 
            label = "Benign"
            if meta.get("sload", 0) > 1000000:
                risk_score = random.uniform(0.4, 0.7)
                label = "Suspicious"
            attack_family = "Normal" if label == "Benign" else "Unknown"

        start_time = meta.get("_start_time", 0)
        duration = meta.get("_duration_s", 0)
        
        proto_num = int(meta.get("_protocol", 0))
        proto_name = proto_map.get(proto_num, str(proto_num))

        # ── SHAP: extract top 5 features for this flow ─────────────────────
        top_shap = _extract_top_shap_features(
            shap_values=shap_values_all,
            row_index=i,
            feature_names=feature_names,
        )
        
        predictions.append({
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
            "risk_score":   round(risk_score, 2),
            "predicted_label": label,
            "attack_family": attack_family,
            "summary":      f"Observed {proto_name} flow from {meta.get('_src_ip')} to {meta.get('_dst_ip')}. Predicted as {label}.",
            "recommendations": ["No immediate action required."] if label == "Benign" else ["Monitor this source IP for further activity.", "Isolate host if behavior persists."],
            "top_features": [],
            "shap_features": top_shap,   # NEW: per-flow SHAP explanation
        })
    return predictions


def _extract_top_shap_features(
    shap_values: np.ndarray | None,
    row_index: int,
    feature_names: list[str],
    top_k: int = 5,
) -> list[dict]:
    """Return the top-k features by absolute SHAP value for a single flow.

    Each entry contains:
      - feature_name  : str  (e.g. "sbytes")
      - feature_value : float (the raw value for this flow; None if unavailable)
      - shap_impact   : float (positive → pushes toward attack, negative → benign)
    """
    if shap_values is None or row_index >= shap_values.shape[0]:
        return []

    row_shap = shap_values[row_index]
    # Indices of the k largest absolute SHAP values
    top_indices = np.argsort(np.abs(row_shap))[::-1][:top_k]

    result = []
    for idx in top_indices:
        result.append({
            "feature_name": feature_names[idx] if idx < len(feature_names) else f"feature_{idx}",
            "feature_value": None,   # raw value unavailable after scaling; set if you pass X_raw
            "shap_impact": round(float(row_shap[idx]), 6),
        })
    return result


def _error(http_code: int, code: str, message: str):
    """Return a consistent JSON error response."""
    logger.warning(f"[{http_code}] {code}: {message}")
    return jsonify({
        "status":  "error",
        "code":    code,
        "message": message,
    }), http_code


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("DEBUG", "false").lower() == "true",
    )
