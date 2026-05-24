import joblib
import os

ENCODERS_PATH = "models/encoders.pkl"

if os.path.exists(ENCODERS_PATH):
    encoders = joblib.load(ENCODERS_PATH)
    print(f"Keys in encoders: {list(encoders.keys())}")
else:
    print("Encoders file not found.")
