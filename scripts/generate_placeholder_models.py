import os
import pickle
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder

def generate_placeholders():
    models_dir = "models"
    os.makedirs(models_dir, exist_ok=True)

    # 1. Feature Order (from training notebook)
    features = [
        'sport', 'dsport', 'proto', 'state', 'dur', 'sbytes', 'dbytes', 
        'sttl', 'dttl', 'service', 'sload', 'dload', 'spkts', 'dpkts', 
        'dwin', 'stcpb', 'dtcpb', 'trans_depth', 'res_bdy_len', 'sjit', 
        'djit', 'sintpkt', 'dintpkt', 'tcprtt', 'synack', 'ackdat', 
        'is_sm_ips_ports', 'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 
        'ct_ftp_cmd', 'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 
        'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm'
    ]

    # 2. Categorical Encoders
    # We'll create a dictionary of encoders for proto, service, state
    # Based on UNSW-NB15 typical values
    encoders = {}
    
    # Proto
    le_proto = LabelEncoder()
    le_proto.fit(['tcp', 'udp', 'icmp', 'ospf', 'sctp', 'gre']) # and others, but these are common
    encoders['proto'] = le_proto

    # Service
    le_service = LabelEncoder()
    le_service.fit(['none', 'http', 'ftp', 'smtp', 'ssh', 'dns', 'ftp-data', 'irc', 'pop3', 'snmp', 'ssl', 'dhcp', 'radius'])
    encoders['service'] = le_service

    # State
    le_state = LabelEncoder()
    le_state.fit(['FIN', 'INT', 'CON', 'REQ', 'RST', 'ACC', 'CLO', 'URP', 'PAR', 'REQ', 'ECO'])
    encoders['state'] = le_state

    # Attack Category Encoder
    le_attack = LabelEncoder()
    attack_cats = ['Analysis', 'Backdoor', 'DoS', 'Exploits', 'Fuzzers', 'Generic', 'Normal', 'Reconnaissance', 'Shellcode', 'Worms']
    le_attack.fit(attack_cats)
    encoders['attack_cat'] = le_attack

    with open(os.path.join(models_dir, "encoders.pkl"), "wb") as f:
        pickle.dump(encoders, f)
    print("Saved models/encoders.pkl")

    # 3. Scaler
    scaler = StandardScaler()
    # Dummy fit on zero data with 38 features
    dummy_data = np.zeros((10, 38))
    scaler.fit(dummy_data)
    with open(os.path.join(models_dir, "scaler.pkl"), "wb") as f:
        pickle.dump(scaler, f)
    print("Saved models/scaler.pkl")

    # 4. Binary Classifier (Random Forest)
    rf_bin = RandomForestClassifier(n_estimators=10, random_state=42)
    # Fit on dummy data (Normal vs Attack)
    X = np.random.rand(20, 38)
    y = np.random.randint(0, 2, 20)
    rf_bin.fit(X, y)
    with open(os.path.join(models_dir, "rf_binary.pkl"), "wb") as f:
        pickle.dump(rf_bin, f)
    print("Saved models/rf_binary.pkl")

    # 5. Multi-class Classifier
    rf_multi = RandomForestClassifier(n_estimators=10, random_state=42)
    # Fit on dummy data (10 classes)
    y_multi = np.random.randint(0, 10, 20)
    rf_multi.fit(X, y_multi)
    with open(os.path.join(models_dir, "rf_multiclass.pkl"), "wb") as f:
        pickle.dump(rf_multi, f)
    print("Saved models/rf_multiclass.pkl")

    print("\nPlaceholder models generated successfully.")
    print("Note: These models will give random/baseline predictions.")

if __name__ == "__main__":
    generate_placeholders()
