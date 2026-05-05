import joblib
import os

# Paths
MODEL_DIR = r"c:\Users\souro\Desktop\NIDS_UNSW_NB15_Project\models"
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")

def check_attack_only():
    encoders = joblib.load(ENCODERS_PATH)
    if 'attack_only' in encoders:
        print("Encoder 'attack_only' classes:")
        for i, cls in enumerate(encoders['attack_only'].classes_):
            print(f"  {i}: {cls}")
    else:
        print("'attack_only' not found in encoders.pkl")

if __name__ == "__main__":
    check_attack_only()
