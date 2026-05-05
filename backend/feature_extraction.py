"""
PCAP Feature Extraction Pipeline (UNSW-NB15 Optimized)
======================================================
Converts a raw .pcap file into a feature matrix matching the 38-feature 
schema used in the UNSW-NB15 dataset training.

Key features:
- Bidirectional flow aggregation.
- Precise TCP state tracking (FIN, INT, CON, REQ, RST, etc.).
- Application-layer extraction (HTTP transactions, FTP commands).
- Sliding window connection counters (Group 7 features).
- Strict schema enforcement for ML inference.
"""

import os
import socket
import logging
import time
import warnings
import math
import collections
from typing import Optional, List, Dict, Tuple

import dpkt
import numpy as np
import pandas as pd
import pickle

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTS & CONFIG
# ══════════════════════════════════════════════════════════════════════════════

TCP_FIN, TCP_SYN, TCP_RST, TCP_PSH, TCP_ACK, TCP_URG = 0x01, 0x02, 0x04, 0x08, 0x10, 0x20

FEATURE_COLUMNS = [
    'sport', 'dsport', 'proto', 'state', 'dur', 'sbytes', 'dbytes', 
    'sttl', 'dttl', 'service', 'sload', 'dload', 'spkts', 'dpkts', 
    'dwin', 'stcpb', 'dtcpb', 'trans_depth', 'res_bdy_len', 'sjit', 
    'djit', 'sintpkt', 'dintpkt', 'tcprtt', 'synack', 'ackdat', 
    'is_sm_ips_ports', 'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 
    'ct_ftp_cmd', 'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 
    'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm'
]

PROTO_MAP = {6: 'tcp', 17: 'udp', 1: 'icmp', 47: 'gre', 50: 'esp', 51: 'ah', 89: 'ospf', 132: 'sctp'}

# ══════════════════════════════════════════════════════════════════════════════
#  UTILITIES
# ══════════════════════════════════════════════════════════════════════════════

class RunningStats:
    """Computes mean/std in a single pass using Welford's algorithm."""
    def __init__(self):
        self.n = 0
        self.mean = 0.0
        self.m2 = 0.0

    def update(self, x: float):
        self.n += 1
        delta = x - self.mean
        self.mean += delta / self.n
        delta2 = x - self.mean
        self.m2 += delta * delta2

    @property
    def std(self) -> float:
        if self.n < 2: return 0.0
        return math.sqrt(self.m2 / (self.n - 1))

# ══════════════════════════════════════════════════════════════════════════════
#  FLOW TRACKING
# ══════════════════════════════════════════════════════════════════════════════

class FlowRecord:
    def __init__(self, pkt: dict):
        self.src_ip = pkt["src_ip"]
        self.dst_ip = pkt["dst_ip"]
        self.sport = pkt["src_port"]
        self.dsport = pkt["dst_port"]
        self.proto_num = pkt["protocol"]
        self.proto_name = PROTO_MAP.get(self.proto_num, str(self.proto_num)).lower()
        
        self.start_ts = pkt["timestamp"]
        self.last_ts = pkt["timestamp"]
        self.last_fwd_ts = pkt["timestamp"]
        self.last_bwd_ts = None
        
        # Bytes and Packets
        self.sbytes = pkt["ip_len"]
        self.dbytes = 0
        self.spkts = 1
        self.dpkts = 0
        
        # TTLs (FIRST packet in each direction)
        self.sttl = pkt["ttl"]
        self.dttl = 0
        
        # Inter-packet arrival times
        self.iat_fwd = RunningStats()
        self.iat_bwd = RunningStats()
        
        # TCP specific
        self.tcp_state = "INT"
        self.fwd_flags = pkt["tcp_flags"]
        self.bwd_flags = 0
        self.dwin = 0
        self.stcpb = 0
        self.dtcpb = 0
        
        # Handshake timing
        self.ts_syn = pkt["timestamp"] if (pkt["tcp_flags"] & TCP_SYN and not (pkt["tcp_flags"] & TCP_ACK)) else None
        self.ts_synack = None
        self.ts_ack_after_synack = None
        
        if self.proto_num == 6:
            self.stcpb = pkt.get("seq", 0)
        
        # App Layer
        self.service = self._detect_service()
        self.trans_depth = 0
        self.res_bdy_len = 0
        self.is_ftp_login = 0
        self.ftp_cmds = 0
        self.http_methods = set()
        
        self._parse_app_layer(pkt)

    def _detect_service(self) -> str:
        ports = {self.sport, self.dsport}
        mapping = {
            80: "http", 21: "ftp", 20: "ftp-data", 25: "smtp", 465: "smtp", 587: "smtp",
            22: "ssh", 53: "dns", 67: "dhcp", 68: "dhcp", 161: "snmp", 443: "https",
            110: "pop3", 6667: "irc"
        }
        for p in ports:
            if p in mapping: return mapping[p]
        return "none"

    def _parse_app_layer(self, pkt: dict):
        payload = pkt.get("payload", b"")
        if not payload: return

        # HTTP Tracking
        if self.service == "http":
            try:
                # Basic check for request methods
                if payload.startswith((b'GET', b'POST', b'PUT', b'DELETE', b'HEAD')):
                    method = payload.split(b' ')[0].decode('utf-8', 'ignore')
                    self.http_methods.add(method)
                    self.trans_depth += 1
                # Basic check for response
                elif payload.startswith(b'HTTP/'):
                    # Roughly estimate body length from Content-Length header if present
                    if b'Content-Length:' in payload:
                        parts = payload.split(b'Content-Length:')
                        if len(parts) > 1:
                            length_str = parts[1].split(b'\r\n')[0].strip()
                            if length_str.isdigit():
                                self.res_bdy_len += int(length_str)
            except: pass

        # FTP Tracking
        if self.service == "ftp":
            try:
                text = payload.decode('utf-8', 'ignore').upper()
                cmds = ["LIST", "RETR", "STOR", "DELE", "USER", "PASS", "PORT", "PASV", "TYPE"]
                for c in cmds:
                    if text.startswith(c):
                        self.ftp_cmds += 1
                if "USER" in text and "PASS" in text: # Simplistic session check
                    self.is_ftp_login = 1
            except: pass

    def update(self, pkt: dict):
        is_fwd = (pkt["src_ip"] == self.src_ip)
        ts = pkt["timestamp"]
        
        if is_fwd:
            self.iat_fwd.update(ts - self.last_fwd_ts)
            self.last_fwd_ts = ts
            self.sbytes += pkt["ip_len"]
            self.spkts += 1
            self.fwd_flags |= pkt["tcp_flags"]
            
            # Check for ACK after SYN-ACK (Handshake completion)
            if self.ts_synack and (pkt["tcp_flags"] & TCP_ACK) and not (pkt["tcp_flags"] & TCP_SYN):
                if self.ts_ack_after_synack is None:
                    self.ts_ack_after_synack = ts
        else:
            if self.last_bwd_ts is not None:
                self.iat_bwd.update(ts - self.last_bwd_ts)
            else:
                self.dttl = pkt["ttl"] # First packet from destination
                self.dwin = pkt.get("win", 0)
                if pkt["tcp_flags"] & TCP_SYN and pkt["tcp_flags"] & TCP_ACK:
                    self.dtcpb = pkt.get("seq", 0)
                    self.ts_synack = ts
            
            self.last_bwd_ts = ts
            self.dbytes += pkt["ip_len"]
            self.dpkts += 1
            self.bwd_flags |= pkt["tcp_flags"]

        self.last_ts = ts
        self._parse_app_layer(pkt)
        self._update_tcp_state(pkt, is_fwd)

    def _update_tcp_state(self, pkt: dict, is_fwd: bool):
        if self.proto_num != 6:
            if self.proto_num == 1: self.tcp_state = "no"
            else: self.tcp_state = "CON" if self.dpkts > 0 else "INT"
            return

        flags = pkt["tcp_flags"]
        
        if flags & TCP_RST:
            # CLO: closed by RST after data exchange (FIN seen)
            self.tcp_state = "CLO" if (self.fwd_flags & TCP_FIN or self.bwd_flags & TCP_FIN) else "RST"
        elif flags & TCP_FIN:
            self.tcp_state = "FIN"
        elif flags & TCP_URG:
            self.tcp_state = "URN"
        else:
            if self.ts_synack:
                # CON/ACC ambiguity: We use CON if data is flowing, ACC if just accepted
                if self.spkts > 2 and self.dpkts > 2:
                    self.tcp_state = "CON"
                else:
                    self.tcp_state = "ACC"
            elif self.ts_syn:
                self.tcp_state = "REQ"
            else:
                if self.tcp_state not in ["CON", "ACC", "REQ", "FIN", "RST", "CLO", "URN"]:
                    self.tcp_state = "INT"

    def to_feature_dict(self) -> dict:
        dur = self.last_ts - self.start_ts
        
        # Timing
        tcprtt = 0.0
        synack = 0.0
        ackdat = 0.0
        if self.ts_syn and self.ts_synack:
            synack = self.ts_synack - self.ts_syn
            tcprtt = synack # Simplified UNSW definition
            if self.ts_ack_after_synack:
                ackdat = self.ts_ack_after_synack - self.ts_synack

        return {
            # Metadata (hidden from model)
            "_src_ip": self.src_ip, "_dst_ip": self.dst_ip, "_start_time": self.start_ts,
            
            # Features
            "sport": self.sport,
            "dsport": self.dsport,
            "proto": self.proto_name,
            "state": self.tcp_state,
            "dur": round(dur, 6),
            "sbytes": self.sbytes,
            "dbytes": self.dbytes,
            "sttl": self.sttl,
            "dttl": self.dttl,
            "service": self.service,
            "sload": (self.sbytes * 8) / max(dur, 1e-6),
            "dload": (self.dbytes * 8) / max(dur, 1e-6),
            "spkts": self.spkts,
            "dpkts": self.dpkts,
            "dwin": self.dwin,
            "stcpb": self.stcpb,
            "dtcpb": self.dtcpb,
            "trans_depth": self.trans_depth,
            "res_bdy_len": self.res_bdy_len,
            "sjit": self.iat_fwd.std * 1000,
            "djit": self.iat_bwd.std * 1000,
            "sintpkt": self.iat_fwd.mean * 1000,
            "dintpkt": self.iat_bwd.mean * 1000,
            "tcprtt": tcprtt,
            "synack": synack,
            "ackdat": ackdat,
            "is_sm_ips_ports": 1 if (self.src_ip == self.dst_ip and self.sport == self.dsport) else 0,
            "ct_flw_http_mthd": len(self.http_methods),
            "is_ftp_login": self.is_ftp_login,
            "ct_ftp_cmd": self.ftp_cmds,
            
            # Placeholders for Window features (Group 7)
            "ct_state_ttl": 0, "ct_srv_src": 0, "ct_srv_dst": 0, "ct_dst_ltm": 0,
            "ct_src_ltm": 0, "ct_src_dport_ltm": 0, "ct_dst_sport_ltm": 0, "ct_dst_src_ltm": 0
        }

# ══════════════════════════════════════════════════════════════════════════════
#  WINDOW TRACKING (GROUP 7)
# ══════════════════════════════════════════════════════════════════════════════

class WindowTracker:
    def __init__(self, size=100, time_window=2.0):
        self.window = collections.deque()
        self.size = size
        self.time_window = time_window

    def process_and_finalize(self, flow_dict: dict) -> dict:
        self.window.append(flow_dict)
        
        # Maintain window constraints
        while len(self.window) > self.size:
            self.window.popleft()
        
        curr_ts = flow_dict["_start_time"]
        while len(self.window) > 1 and (curr_ts - self.window[0]["_start_time"]) > self.time_window:
            self.window.popleft()

        # Compute Group 7 features
        f = flow_dict
        
        # ct_state_ttl: Count same (state, sttl, dttl)
        f["ct_state_ttl"] = sum(1 for w in self.window if (w["state"] == f["state"] and w["sttl"] == f["sttl"] and w["dttl"] == f["dttl"]))
        
        # ct_srv_src: Same (src_ip, service)
        f["ct_srv_src"] = sum(1 for w in self.window if (w["_src_ip"] == f["_src_ip"] and w["service"] == f["service"]))
        
        # ct_srv_dst: Same (dst_ip, service)
        f["ct_srv_dst"] = sum(1 for w in self.window if (w["_dst_ip"] == f["_dst_ip"] and w["service"] == f["service"]))
        
        # ct_dst_ltm: Same (dst_ip)
        f["ct_dst_ltm"] = sum(1 for w in self.window if (w["_dst_ip"] == f["_dst_ip"]))
        
        # ct_src_ltm: Same (src_ip)
        f["ct_src_ltm"] = sum(1 for w in self.window if (w["_src_ip"] == f["_src_ip"]))
        
        # ct_src_dport_ltm: Same (src_ip, dsport)
        f["ct_src_dport_ltm"] = sum(1 for w in self.window if (w["_src_ip"] == f["_src_ip"] and w["dsport"] == f["dsport"]))
        
        # ct_dst_sport_ltm: Same (dst_ip, sport)
        f["ct_dst_sport_ltm"] = sum(1 for w in self.window if (w["_dst_ip"] == f["_dst_ip"] and w["sport"] == f["sport"]))
        
        # ct_dst_src_ltm: Same (src_ip, dst_ip) pair
        f["ct_dst_src_ltm"] = sum(1 for w in self.window if (w["_src_ip"] == f["_src_ip"] and w["_dst_ip"] == f["_dst_ip"]))

        return f

# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE ENTRY
# ══════════════════════════════════════════════════════════════════════════════

def extract_features_from_pcap(filepath: str, scaler_path: str = "models/scaler.pkl", encoders: dict = None, flow_timeout: float = 60.0) -> tuple:
    if not os.path.exists(filepath): raise FileNotFoundError(filepath)
    
    active_flows: dict[tuple, FlowRecord] = {}
    final_features = []
    window = WindowTracker()
    pkt_count = 0

    with open(filepath, "rb") as f:
        magic = f.read(4)
        f.seek(0)
        opener = dpkt.pcapng.Reader if magic == b"\x0a\x0d\x0d\x0a" else dpkt.pcap.Reader
        try:
            pcap = opener(f)
        except: raise ValueError("Invalid PCAP")

        for ts, raw_buf in pcap:
            pkt_count += 1
            try:
                # Basic IP decoding
                eth = dpkt.ethernet.Ethernet(raw_buf)
                if not isinstance(eth.data, dpkt.ip.IP): continue
                ip = eth.data
                
                src_ip = socket.inet_ntoa(ip.src)
                dst_ip = socket.inet_ntoa(ip.dst)
                proto = ip.p
                
                src_port = dst_port = tcp_flags = seq = win = 0
                payload = b""
                
                if isinstance(ip.data, dpkt.tcp.TCP):
                    t = ip.data
                    src_port, dst_port, tcp_flags, seq, win = t.sport, t.dport, t.flags, t.seq, t.win
                    payload = t.data
                elif isinstance(ip.data, dpkt.udp.UDP):
                    t = ip.data
                    src_port, dst_port = t.sport, t.dport
                    payload = t.data

                pkt = {
                    "timestamp": float(ts), "src_ip": src_ip, "dst_ip": dst_ip,
                    "src_port": src_port, "dst_port": dst_port, "protocol": proto,
                    "ip_len": ip.len, "ttl": ip.ttl, "tcp_flags": tcp_flags,
                    "seq": seq, "win": win, "payload": payload
                }

                # Flow Key (Bidirectional)
                ep_a, ep_b = (src_ip, src_port), (dst_ip, dst_port)
                if ep_a > ep_b: ep_a, ep_b = ep_b, ep_a
                key = (*ep_a, *ep_b, proto)

                if key in active_flows:
                    active_flows[key].update(pkt)
                else:
                    active_flows[key] = FlowRecord(pkt)

                # Periodic cleanup of timed-out flows
                if pkt_count % 50000 == 0:
                    expired = [k for k, v in active_flows.items() if (ts - v.last_ts) > 60.0]
                    for k in expired:
                        f_dict = active_flows.pop(k).to_feature_dict()
                        final_features.append(window.process_and_finalize(f_dict))

            except: continue

    # Flush remaining
    for flow in active_flows.values():
        f_dict = flow.to_feature_dict()
        final_features.append(window.process_and_finalize(f_dict))

    if not final_features: raise RuntimeError("No flows extracted")

    # Final Preprocessing
    return prepare_for_model(final_features, scaler_path, encoders=encoders)

def prepare_for_model(feature_dicts: List[dict], scaler_path: str, encoders: dict = None) -> tuple:
    df_all = pd.DataFrame(feature_dicts)
    
    # 1. Hex to Int (STEP 1)
    def to_int_safe(x):
        if isinstance(x, str):
            if x.lower().startswith('0x'):
                try: return int(x, 16)
                except: return 0
            try: return int(float(x))
            except: return 0
        if pd.isna(x): return 0
        return int(x)

    for col in ['sport', 'dsport', 'ct_ftp_cmd']:
        if col in df_all.columns:
            df_all[col] = df_all[col].apply(to_int_safe)
    
    # 2. Type casting & semantic fills (STEP 2 & 3)
    df = df_all.copy()
    df["service"] = df["service"].fillna("none").replace({"": "none", "-": "none"})
    df["is_ftp_login"] = df["is_ftp_login"].fillna(0).astype(int)
    df["ct_flw_http_mthd"] = df["ct_flw_http_mthd"].fillna(0).astype(int)
    
    # 3. Encoding
    X = df[FEATURE_COLUMNS].copy()
    if encoders:
        for col in ["proto", "service", "state"]:
            if col in encoders:
                le = encoders[col]
                # Enforce case
                if col == "state": X[col] = X[col].astype(str).str.upper()
                else: X[col] = X[col].astype(str).str.lower()
                
                known = set(le.classes_)
                X[col] = X[col].apply(lambda x: x if x in known else le.classes_[0])
                X[col] = le.transform(X[col])

    # 4. Enforce strict types
    int_cols = [
        'sport', 'dsport', 'sbytes', 'dbytes', 'sttl', 'dttl', 'spkts', 'dpkts', 'dwin',
        'stcpb', 'dtcpb', 'trans_depth', 'res_bdy_len', 'is_sm_ips_ports',
        'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 'ct_ftp_cmd',
        'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm',
        'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm'
    ]
    float_cols = ['dur', 'sload', 'dload', 'sjit', 'djit', 'sintpkt', 'dintpkt', 'tcprtt', 'synack', 'ackdat']
    
    for c in int_cols: X[c] = X[c].astype(np.int64)
    for c in float_cols: X[c] = X[c].astype(np.float64)

    # 5. Column Order (STEP 5)
    X = X[FEATURE_COLUMNS]
    X_raw = X.copy()

    # ════════════════════════════════════════════════════════════════
    # PART 4 — FINAL VERIFICATION CHECKLIST
    # ════════════════════════════════════════════════════════════════
    assert X.shape[1] == 38, f"Final shape mismatch: {X.shape[1]} columns (Expected 38)"
    assert not X.isnull().values.any(), "Verification Failed: NaN values detected in feature matrix"
    
    # Check types (STEP 3)
    for c in int_cols:
        assert X[c].dtype == np.int64, f"Verification Failed: Column {c} is not int64"
    for c in float_cols:
        assert X[c].dtype == np.float64, f"Verification Failed: Column {c} is not float64"
    
    # Check for forbidden columns
    forbidden = ["srcip", "dstip", "stime", "ltime", "sloss", "dloss", "swin", "smeansz", "dmeansz", "attack_cat", "label"]
    for f_col in forbidden:
        assert f_col not in X.columns, f"Verification Failed: Forbidden column {f_col} detected"

    # 6. Scaling
    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)
    X_scaled = scaler.transform(X)

    # Metadata
    meta_cols = [c for c in df_all.columns if c.startswith("_")]
    df_meta = df_all[meta_cols].copy()
    
    summary = {
        "total_flows": len(feature_dicts),
        "feature_count": X.shape[1],
        "feature_names": FEATURE_COLUMNS
    }

    return X_scaled, X_raw, df_meta, summary
