import joblib
import os

ENCODERS_PATH = "models/encoders.pkl"

if os.path.exists(ENCODERS_PATH):
    encoders = joblib.load(ENCODERS_PATH)
    le_attack = encoders.get('attack_cat')
    if le_attack:
        print(f"Attack categories: {le_attack.classes_.tolist()}")
    else:
        print("attack_cat encoder not found.")
else:
    print("Encoders file not found.")
