import joblib
import os

ENCODERS_PATH = "models/encoders.pkl"

if os.path.exists(ENCODERS_PATH):
    encoders = joblib.load(ENCODERS_PATH)
    le_proto = encoders.get('proto')
    if le_proto:
        print(f"Protocol classes: {le_proto.classes_.tolist()[:20]}")
    le_service = encoders.get('service')
    if le_service:
        print(f"Service classes: {le_service.classes_.tolist()[:20]}")
    le_state = encoders.get('state')
    if le_state:
        print(f"State classes: {le_state.classes_.tolist()[:20]}")
else:
    print("Encoders file not found.")
