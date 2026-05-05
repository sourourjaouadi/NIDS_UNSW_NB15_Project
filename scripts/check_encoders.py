import joblib
import pandas as pd
import numpy as np
import os

# Paths
MODEL_DIR = r"c:\Users\souro\Desktop\NIDS_UNSW_NB15_Project\models"
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")

def check_encoders():
    encoders = joblib.load(ENCODERS_PATH)
    print("--- Encoder Classes Check ---")
    if isinstance(encoders, dict):
        for name, enc in encoders.items():
            if hasattr(enc, "classes_"):
                print(f"\nEncoder '{name}' classes (first 10):")
                print(list(enc.classes_)[:10])
                # Check case
                sample = str(enc.classes_[0])
                if sample.islower():
                    print(f"  Note: '{name}' seems to be LOWERCASE")
                elif sample.isupper():
                    print(f"  Note: '{name}' seems to be UPPERCASE")
                else:
                    print(f"  Note: '{name}' mixed or numeric")

if __name__ == "__main__":
    check_encoders()
