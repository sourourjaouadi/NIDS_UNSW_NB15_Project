import joblib
import pandas as pd
import numpy as np
import os
import sys

# Add backend to path to import feature_extraction
sys.path.append(os.path.abspath("backend"))
from feature_extraction import prepare_for_model, FEATURE_COLUMNS

# Paths
MODEL_DIR = r"c:\Users\souro\Desktop\NIDS_UNSW_NB15_Project\models"
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")

def verify_fix():
    print("--- Verifying Case Sensitivity Fix ---")
    encoders = joblib.load(ENCODERS_PATH)
    
    # Mock data with various cases
    mock_flows = [
        {
            "sport": 1234, "dsport": 80, "proto": "tcp", "state": "fin", 
            "dur": 0.1, "sbytes": 100, "dbytes": 100, "sttl": 64, "dttl": 64,
            "service": "HTTP", "sload": 1000, "dload": 1000, "spkts": 10, "dpkts": 10,
            "dwin": 255, "stcpb": 0, "dtcpb": 0, "trans_depth": 0, "res_bdy_len": 0,
            "sjit": 0, "djit": 0, "sintpkt": 0, "dintpkt": 0, "tcprtt": 0, "synack": 0, "ackdat": 0,
            "is_sm_ips_ports": 0, "ct_state_ttl": 0, "ct_flw_http_mthd": 0, "is_ftp_login": 0,
            "ct_ftp_cmd": 0, "ct_srv_src": 1, "ct_srv_dst": 1, "ct_dst_ltm": 1, "ct_src_ltm": 1,
            "ct_src_dport_ltm": 1, "ct_dst_sport_ltm": 1, "ct_dst_src_ltm": 1
        }
    ]
    
    # Run the prepare_for_model logic
    X_scaled, X_raw, df_meta = prepare_for_model(mock_flows, SCALER_PATH, encoders=encoders)
    
    print(f"\nProcessed Proto (Encoded value): {X_raw.iloc[0]['proto']}")
    print(f"Processed Service (Encoded value): {X_raw.iloc[0]['service']}")
    print(f"Processed State (Encoded value): {X_raw.iloc[0]['state']}")

    # Check if they are mapped to the first class (which would indicate failure)
    if X_raw.iloc[0]['proto'] == encoders['proto'].transform([encoders['proto'].classes_[0]])[0]:
         if encoders['proto'].classes_[0] != 'tcp':
             print("WARNING: Proto might still be failing (mapped to first class)")
    else:
        print("SUCCESS: Proto mapped to non-default value (likely correct)")

if __name__ == "__main__":
    verify_fix()
