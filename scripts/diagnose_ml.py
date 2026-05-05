import joblib
import pandas as pd
import numpy as np
import os

# Paths
MODEL_DIR = r"c:\Users\souro\Desktop\NIDS_UNSW_NB15_Project\models"
BINARY_MODEL_PATH = os.path.join(MODEL_DIR, "rf_binary.pkl")
MULTI_MODEL_PATH = os.path.join(MODEL_DIR, "rf_multiclass.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")

def diagnose():
    scaler = joblib.load(SCALER_PATH)
    encoders = joblib.load(ENCODERS_PATH)
    rf_bin = joblib.load(BINARY_MODEL_PATH)
    rf_multi = joblib.load(MULTI_MODEL_PATH)

    FEATURE_COLUMNS = [
        'sport', 'dsport', 'proto', 'state', 'dur', 'sbytes', 'dbytes', 
        'sttl', 'dttl', 'service', 'sload', 'dload', 'spkts', 'dpkts', 
        'dwin', 'stcpb', 'dtcpb', 'trans_depth', 'res_bdy_len', 'sjit', 
        'djit', 'sintpkt', 'dintpkt', 'tcprtt', 'synack', 'ackdat', 
        'is_sm_ips_ports', 'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 
        'ct_ftp_cmd', 'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 
        'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm'
    ]

    print("--- [1] Column Order Check ---")
    if hasattr(scaler, "feature_names_in_"):
        scaler_names = list(scaler.feature_names_in_)
        print(f"Scaler expected: {scaler_names}")
        print(f"Code has:       {FEATURE_COLUMNS}")
        if scaler_names == FEATURE_COLUMNS:
            print("ORDER MATCHES")
        else:
            print("ORDER MISMATCH!")
            for i, (s, c) in enumerate(zip(scaler_names, FEATURE_COLUMNS)):
                if s != c:
                    print(f"  Mismatch at {i}: Scaler={s}, Code={c}")
    else:
        print("Scaler has no feature names. Cannot verify order.")

    print("\n--- [2] Scaler Stats ---")
    if hasattr(scaler, "mean_"):
        print(f"Scaler mean (first 10): {scaler.mean_[:10]}")
        print(f"Scaler scale (first 10): {scaler.scale_[:10]}")
    else:
        print("Scaler has no mean_ (Identity scaler?)")

    print("\n--- [3] Prediction Diagnostic ---")
    mock_raw = {col: 10.0 for col in FEATURE_COLUMNS} # Use non-zero
    df_raw = pd.DataFrame([mock_raw])
    X_scaled = scaler.transform(df_raw)
    
    print("Vector BEFORE scaling (38 values):")
    print(df_raw.values[0])
    print("\nVector AFTER scaling (38 values):")
    print(X_scaled[0])

    prob_bin = rf_bin.predict_proba(X_scaled)
    print(f"\nBinary predict_proba: {prob_bin}")
    print(f"Binary classes: {rf_bin.classes_}")

    prob_multi = rf_multi.predict_proba(X_scaled)
    print(f"\nMulticlass predict_proba: {prob_multi}")
    print(f"Multiclass classes: {rf_multi.classes_}")

    print("\n--- [4] Encoder Classes ---")
    le_attack = encoders.get("attack_only") or encoders.get("attack_cat")
    if le_attack:
        for i, cls in enumerate(le_attack.classes_):
            print(f"  {i}: {cls}")

if __name__ == "__main__":
    diagnose()
