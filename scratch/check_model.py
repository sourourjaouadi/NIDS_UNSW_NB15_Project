import joblib
import os

MODEL_DIR = "models"
BINARY_MODEL_PATH = os.path.join(MODEL_DIR, "rf_binary.pkl")

if os.path.exists(BINARY_MODEL_PATH):
    model = joblib.load(BINARY_MODEL_PATH)
    if hasattr(model, "n_features_in_"):
        print(f"Model expects {model.n_features_in_} features.")
    if hasattr(model, "feature_names_in_"):
        print(f"Feature names in model: {model.feature_names_in_.tolist()}")
else:
    print("Model file not found.")
