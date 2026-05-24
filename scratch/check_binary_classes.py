import joblib
import os

BINARY_MODEL_PATH = "models/rf_binary.pkl"

if os.path.exists(BINARY_MODEL_PATH):
    model = joblib.load(BINARY_MODEL_PATH)
    print(f"Model classes: {model.classes_.tolist()}")
else:
    print("Model file not found.")
