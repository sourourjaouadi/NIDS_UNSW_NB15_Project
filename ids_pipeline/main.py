from __future__ import annotations

import json
import math
import pickle
import tempfile
from pathlib import Path
from typing import Any

try:
    from fastapi import FastAPI, File, HTTPException, UploadFile
except ImportError:  # pragma: no cover - allows demo.py to import without FastAPI installed
    FastAPI = None  # type: ignore
    File = None  # type: ignore
    HTTPException = RuntimeError  # type: ignore
    UploadFile = Any  # type: ignore

try:
    from ids_pipeline.config import (
        ATTACK_LABELS,
        MODEL_ARTIFACTS,
        RF_MODEL_PATH,
        SUPPORTED_EXTENSIONS,
        UPLOAD_MAX_BYTES,
        XGB_MODEL_PATH,
    )
    from ids_pipeline.feature_engineer import engineer_features
    from ids_pipeline.flow_constructor import build_flows
    from ids_pipeline.pcap_parser import demo_packets, parse_pcap
    from ids_pipeline.preprocessor import ProcessedBatch, preprocess_rows
except ImportError:  # pragma: no cover
    from config import (
        ATTACK_LABELS,
        MODEL_ARTIFACTS,
        RF_MODEL_PATH,
        SUPPORTED_EXTENSIONS,
        UPLOAD_MAX_BYTES,
        XGB_MODEL_PATH,
    )
    from feature_engineer import engineer_features
    from flow_constructor import build_flows
    from pcap_parser import demo_packets, parse_pcap
    from preprocessor import ProcessedBatch, preprocess_rows


class InferenceService:
    def __init__(self) -> None:
        self.models = {artifact.name: self._safe_load_model(artifact.path) for artifact in MODEL_ARTIFACTS}

    def _safe_load_model(self, path: Path) -> object | None:
        if not path.exists():
            return None

        try:
            with path.open("rb") as handle:
                return pickle.load(handle)
        except Exception:
            return None

    def predict(self, batch: ProcessedBatch) -> list[dict[str, object]]:
        rf_probs = self._predict_with_model(self.models["random_forest"], batch.matrix, batch.rows)
        xgb_probs = self._predict_with_model(self.models["xgboost"], batch.matrix, batch.rows)

        results: list[dict[str, object]] = []
        for index, row in enumerate(batch.rows):
            rf_prob = rf_probs[index]
            xgb_prob = xgb_probs[index]
            risk_score = round((rf_prob + xgb_prob) / 2, 4)
            label = self._risk_to_label(risk_score)

            results.append(
                {
                    "flow_id": row["flow_id"],
                    "src_ip": row["src_ip"],
                    "dst_ip": row["dst_ip"],
                    "src_port": row["src_port"],
                    "dst_port": row["dst_port"],
                    "proto": row["proto"],
                    "service": row["service"],
                    "risk_score": risk_score,
                    "predicted_label": label,
                    "attack_family": self._infer_attack_family(row, risk_score),
                    "model_votes": {
                        "random_forest": round(rf_prob, 4),
                        "xgboost": round(xgb_prob, 4),
                    },
                    "features": {
                        "dur": row["dur"],
                        "spkts": row["spkts"],
                        "dpkts": row["dpkts"],
                        "sbytes": row["sbytes"],
                        "dbytes": row["dbytes"],
                        "sttl": row["sttl"],
                        "dttl": row["dttl"],
                        "ct_state_ttl": row["ct_state_ttl"],
                    },
                }
            )

        return results

    def _predict_with_model(
        self,
        model: object | None,
        matrix: list[list[float]],
        rows: list[dict[str, object]],
    ) -> list[float]:
        if model is None:
            return [self._heuristic_risk(row) for row in rows]

        try:
            if hasattr(model, "predict_proba"):
                probabilities = model.predict_proba(matrix)
                return [float(item[-1]) for item in probabilities]

            if hasattr(model, "predict"):
                predictions = model.predict(matrix)
                return [float(value) for value in predictions]
        except Exception:
            return [self._heuristic_risk(row) for row in rows]

        return [self._heuristic_risk(row) for row in rows]

    def _heuristic_risk(self, row: dict[str, object]) -> float:
        spkts = float(row["spkts"])
        dpkts = float(row["dpkts"])
        sbytes = float(row["sbytes"])
        dbytes = float(row["dbytes"])
        sttl = float(row["sttl"])
        dttl = float(row["dttl"])
        duration = float(row["dur"])
        ct_state_ttl = float(row["ct_state_ttl"])
        ct_srv_src = float(row["ct_srv_src"])
        service = str(row["service"])
        proto = str(row["proto"])

        score = 0.0
        score += min(spkts / 12.0, 0.28)
        score += min(sbytes / 14.0, 0.24)
        score += min(duration / 3.5, 0.12)
        score += min(ct_state_ttl / 4.0, 0.12)
        score += min(ct_srv_src / 3.0, 0.1)

        ttl_anomaly = max(abs(sttl - 64.0), abs(dttl - 64.0))
        score += min(ttl_anomaly / 120.0, 0.1)

        if service in {"ssh", "rdp", "smb"}:
            score += 0.07
        if proto in {"icmp", "udp"} and (spkts + dpkts) > 4:
            score += 0.05

        return round(min(max(score, 0.02), 0.99), 4)

    def _risk_to_label(self, score: float) -> str:
        if score >= 0.75:
            return ATTACK_LABELS[2]
        if score >= 0.45:
            return ATTACK_LABELS[1]
        return ATTACK_LABELS[0]

    def _infer_attack_family(self, row: dict[str, object], risk_score: float) -> str:
        service = str(row["service"])
        proto = str(row["proto"])
        spkts = float(row["spkts"])
        duration = float(row["dur"])

        if risk_score < 0.45:
            return "Normal Traffic"
        if proto == "icmp":
            return "Analysis"
        if service in {"ssh", "rdp", "smb"}:
            return "Backdoor"
        if service in {"http", "https"} and spkts > 1.5:
            return "Exploits"
        if proto == "udp":
            return "Reconnaissance"
        if duration > 1.2 and spkts > 2.0:
            return "DoS"
        return "Suspicious Activity"


def run_pipeline_from_packets(service: InferenceService, packets: list[Any]) -> dict[str, object]:
    flows = build_flows(packets)
    engineered_rows = engineer_features(flows)
    processed = preprocess_rows(engineered_rows)
    predictions = service.predict(processed)

    return {
        "packet_count": len(packets),
        "flow_count": len(flows),
        "models_loaded": {
            "random_forest": service.models["random_forest"] is not None,
            "xgboost": service.models["xgboost"] is not None,
        },
        "predictions": predictions,
    }


def run_demo_pipeline() -> dict[str, object]:
    service = InferenceService()
    return run_pipeline_from_packets(service, demo_packets())


app = FastAPI(title="IDS Pipeline API", version="0.1.0") if FastAPI is not None else None

if app is not None:

    @app.get("/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok",
            "max_upload_bytes": UPLOAD_MAX_BYTES,
            "rf_model_path": str(RF_MODEL_PATH),
            "xgb_model_path": str(XGB_MODEL_PATH),
        }


    @app.get("/schema")
    def schema() -> dict[str, object]:
        return {
            "supported_extensions": sorted(SUPPORTED_EXTENSIONS),
            "models": [artifact.name for artifact in MODEL_ARTIFACTS],
            "pipeline": [
                "pcap_parser",
                "flow_constructor",
                "feature_engineer",
                "preprocessor",
                "inference",
            ],
        }


    @app.get("/predict/demo")
    def predict_demo() -> dict[str, object]:
        return run_demo_pipeline()


    @app.post("/predict/upload")
    async def predict_upload(file: UploadFile = File(...)) -> dict[str, object]:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file extension: {suffix or 'missing'}")

        payload = await file.read()
        if not payload:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(payload) > UPLOAD_MAX_BYTES:
            raise HTTPException(status_code=400, detail="Uploaded file exceeds the configured size limit.")

        temp_path: str | None = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
                handle.write(payload)
                temp_path = handle.name

            packets = parse_pcap(temp_path)
            service = InferenceService()
            return run_pipeline_from_packets(service, packets)
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    print(json.dumps(run_demo_pipeline(), indent=2))

