import sys
import os
import joblib
import pandas as pd
import numpy as np

# Add backend to path
sys.path.append(os.path.abspath("backend"))
from feature_extraction import extract_features_from_pcap, FEATURE_COLUMNS

def verify_overhaul():
    print("--- Verifying Pipeline Overhaul ---")
    
    # Use a small sample PCAP if available, otherwise just check imports and schema
    pcap_path = r"c:\Users\souro\Desktop\NIDS_UNSW_NB15_Project\scripts\diagnose_ml.py" # Just a file path for import check
    
    # Check FEATURE_COLUMNS
    print(f"Feature Column Count: {len(FEATURE_COLUMNS)}")
    if len(FEATURE_COLUMNS) == 38:
        print("SUCCESS: 38 features defined.")
    else:
        print(f"ERROR: Expected 38 features, got {len(FEATURE_COLUMNS)}")

    # Check for forbidden columns
    forbidden = ["srcip", "dstip", "stime", "ltime", "sloss", "dloss", "swin", "smeansz", "dmeansz", "attack_cat", "label"]
    found_forbidden = [c for c in FEATURE_COLUMNS if c in forbidden]
    if not found_forbidden:
        print("SUCCESS: No forbidden columns in feature list.")
    else:
        print(f"ERROR: Found forbidden columns: {found_forbidden}")

    # Check column order against specification
    expected_order = [
        'sport', 'dsport', 'proto', 'state', 'dur', 'sbytes', 'dbytes', 
        'sttl', 'dttl', 'service', 'sload', 'dload', 'spkts', 'dpkts', 
        'dwin', 'stcpb', 'dtcpb', 'trans_depth', 'res_bdy_len', 'sjit', 
        'djit', 'sintpkt', 'dintpkt', 'tcprtt', 'synack', 'ackdat', 
        'is_sm_ips_ports', 'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 
        'ct_ftp_cmd', 'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 
        'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm'
    ]
    if FEATURE_COLUMNS == expected_order:
        print("SUCCESS: Column order exactly matches specification.")
    else:
        print("ERROR: Column order mismatch!")
        for i, (e, a) in enumerate(zip(expected_order, FEATURE_COLUMNS)):
            if e != a:
                print(f"  Pos {i}: Expected '{e}', got '{a}'")

if __name__ == "__main__":
    verify_overhaul()
