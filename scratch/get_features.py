import joblib
import os

ENCODERS_PATH = "models/encoders.pkl"

if os.path.exists(ENCODERS_PATH):
    encoders = joblib.load(ENCODERS_PATH)
    if 'feature_names' in encoders:
        print("--- Exact Feature Names from Training ---")
        print(encoders['feature_names'])
    else:
        print("feature_names not found in encoders bundle.")
else:
    print("Encoders file not found.")
