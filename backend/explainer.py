from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import shap

try:
    from .feature_semantics import ATTACK_SIGNATURES, FEATURE_SEMANTICS
except ImportError:
    from feature_semantics import ATTACK_SIGNATURES, FEATURE_SEMANTICS


logger = logging.getLogger(__name__)
MODELS_DIR = Path(__file__).parent.parent / "models"


class NIDSExplainer:
    def __init__(self):
        self.explainer_bin = None
        self.explainer_multi = None
        self.feature_names = None
        self.attack_classes = None
        self._loaded = False

    def load(self, rf_binary, rf_multiclass, feature_names, attack_classes):
        self.explainer_bin = shap.TreeExplainer(rf_binary)
        self.explainer_multi = shap.TreeExplainer(rf_multiclass)
        self.feature_names = list(feature_names)
        self.attack_classes = list(attack_classes)
        self._loaded = True
        logger.info("NIDS SHAP explainers loaded.")

    def explain_flow(self, X_row_df, predicted_class_idx):
        if not self._loaded or self.explainer_bin is None:
            raise RuntimeError("NIDSExplainer has not been loaded.")

        shap_result = self.explainer_bin(X_row_df)
        values = np.asarray(shap_result.values)

        if values.ndim == 3:
            values = values[:, :, 1]
        elif values.ndim == 2:
            values = values
        else:
            values = values.reshape(1, -1)

        shap_values = values[0]
        feature_names = self.feature_names or list(X_row_df.columns)

        top_features = []
        for index, feature in enumerate(feature_names):
            shap_value = float(shap_values[index])
            feature_value = X_row_df.iloc[0][feature] if feature in X_row_df.columns else None
            if hasattr(feature_value, "item"):
                feature_value = feature_value.item()

            top_features.append({
                "feature": feature,
                "shap_value": round(shap_value, 4),
                "abs_impact": abs(shap_value),
                "feature_value": feature_value,
                "direction": "toward_attack" if shap_value > 0 else "toward_normal",
                "semantic": FEATURE_SEMANTICS.get(feature, ""),
            })

        top_features.sort(key=lambda item: item["abs_impact"], reverse=True)

        expected_value = self.explainer_bin.expected_value
        if isinstance(expected_value, (list, tuple, np.ndarray)):
            base_value = float(np.asarray(expected_value).reshape(-1)[1])
        else:
            base_value = float(expected_value)

        predicted_class_name = self._attack_class_name(predicted_class_idx)

        return {
            "top_features": top_features,
            "top_10": top_features[:10],
            "base_value": base_value,
            "attack_class_signature": ATTACK_SIGNATURES.get(predicted_class_name, ""),
        }

    def build_chat_context(self, flow_prediction_dict, explain_result):
        return {
            "flow_id": flow_prediction_dict.get("flow_id", ""),
            "is_attack": flow_prediction_dict.get("predicted_label") == "Attack",
            "attack_type": flow_prediction_dict.get("attack_family", "Normal"),
            "attack_probability": round(float(flow_prediction_dict.get("risk_score", 0)) * 100, 2),
            "confidence": round(float(flow_prediction_dict.get("risk_score", 0)) * 100, 2),
            "base_value": explain_result.get("base_value"),
            "attack_signature": explain_result.get("attack_class_signature", ""),
            "top_features": explain_result.get("top_10", []),
            "threshold_used": 0.5,
        }

    def _attack_class_name(self, predicted_class_idx: Any) -> str:
        if not self.attack_classes:
            return str(predicted_class_idx)

        index = int(predicted_class_idx)
        if 0 <= index < len(self.attack_classes):
            return str(self.attack_classes[index])
        return str(predicted_class_idx)


_explainer_instance = NIDSExplainer()


def get_explainer() -> NIDSExplainer:
    return _explainer_instance
