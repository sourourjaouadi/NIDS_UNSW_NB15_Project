"""
PCAP Feature Extraction Pipeline (STREAMING)
=============================================
Converts a raw .pcap file into a scaled numpy feature matrix
ready for the Binary RF / XGBoost classifiers.

Optimization:
- Processes packets one by one (streaming) to support 2GB+ files.
- Uses Welford's algorithm for running mean/std of inter-arrival times and TTL.
- Periodically expires old flows to keep memory usage constant.
"""

import os
import socket
import logging
import time
import warnings
import math
from typing import Optional

import dpkt
import numpy as np
import pandas as pd
import pickle
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
#  CONSTANTS & CONFIG
# ══════════════════════════════════════════════════════════════════════════════

TCP_FIN, TCP_SYN, TCP_RST, TCP_PSH, TCP_ACK, TCP_URG = 0x01, 0x02, 0x04, 0x08, 0x10, 0x20

MODEL_FEATURES = [
    'sport', 'dsport', 'proto', 'state', 'dur', 'sbytes', 'dbytes', 
    'sttl', 'dttl', 'service', 'sload', 'dload', 'spkts', 'dpkts', 
    'dwin', 'stcpb', 'dtcpb', 'trans_depth', 'res_bdy_len', 'sjit', 
    'djit', 'sintpkt', 'dintpkt', 'tcprtt', 'synack', 'ackdat', 
    'is_sm_ips_ports', 'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 
    'ct_ftp_cmd', 'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 
    'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm'
]


class RunningStats:
    """Computes mean/std/min/max in a single pass using Welford's algorithm."""
    def __init__(self):
        self.n = 0
        self.mean = 0.0
        self.m2 = 0.0
        self.min = float('inf')
        self.max = float('-inf')
        self.sum = 0.0

    def update(self, x: float):
        self.n += 1
        self.sum += x
        if x < self.min: self.min = x
        if x > self.max: self.max = x
        
        delta = x - self.mean
        self.mean += delta / self.n
        delta2 = x - self.mean
        self.m2 += delta * delta2

    @property
    def variance(self) -> float:
        return self.m2 / self.n if self.n > 1 else 0.0

    @property
    def std(self) -> float:
        return math.sqrt(self.variance)


class FlowRecord:
    """Accumulates statistics for a bidirectional flow."""
    def __init__(self, pkt: dict):
        self.src_ip = pkt["src_ip"]
        self.dst_ip = pkt["dst_ip"]
        self.src_port = pkt["src_port"]
        self.dst_port = pkt["dst_port"]
        self.protocol = pkt["protocol"]
        
        self.start_ts = pkt["timestamp"]
        self.last_ts = pkt["timestamp"]
        
        self.last_fwd_ts = pkt["timestamp"]
        self.last_bwd_ts = None
        
        self.sbytes = pkt["ip_len"]
        self.dbytes = 0
        self.spkts = 1
        self.dpkts = 0
        
        self.sttl_sum = pkt["ttl"]
        self.dttl_sum = 0
        
        # Inter-arrival Time Stats
        self.iat_all = RunningStats()
        self.iat_fwd = RunningStats()
        self.iat_bwd = RunningStats()
        
        # TCP Flags
        self.flags = {f: 0 for f in ['syn','fin','rst','ack','psh','urg']}
        self._update_flags(pkt["tcp_flags"])

    def _update_flags(self, bits: int):
        if bits & TCP_SYN: self.flags['syn'] += 1
        if bits & TCP_FIN: self.flags['fin'] += 1
        if bits & TCP_RST: self.flags['rst'] += 1
        if bits & TCP_ACK: self.flags['ack'] += 1
        if bits & TCP_PSH: self.flags['psh'] += 1
        if bits & TCP_URG: self.flags['urg'] += 1

    def update(self, pkt: dict):
        is_fwd = (pkt["src_ip"] == self.src_ip)
        ts = pkt["timestamp"]
        
        # Update IATs
        self.iat_all.update(ts - self.last_ts)
        
        if is_fwd:
            self.iat_fwd.update(ts - self.last_fwd_ts)
            self.last_fwd_ts = ts
            self.sbytes += pkt["ip_len"]
            self.spkts += 1
            self.sttl_sum += pkt["ttl"]
        else:
            if self.last_bwd_ts is not None:
                self.iat_bwd.update(ts - self.last_bwd_ts)
            self.last_bwd_ts = ts
            self.dbytes += pkt["ip_len"]
            self.dpkts += 1
            self.dttl_sum += pkt["ttl"]

        self.last_ts = ts
        self._update_flags(pkt["tcp_flags"])

    def to_feature_dict(self) -> dict:
        dur = max(self.last_ts - self.start_ts, 1e-9)
        
        return {
            "_src_ip": self.src_ip, "_dst_ip": self.dst_ip,
            "_src_port": self.src_port, "_dst_port": self.dst_port,
            "_protocol": self.protocol, "_start_time": self.start_ts,
            "_duration_s": dur,

            "sport": self.src_port,
            "dsport": self.dst_port,
            "proto": str(self.protocol), # Use string for consistency before encoding
            "state": "FIN" if self.flags['fin'] > 0 else "CON" if self.protocol == 6 else "INT", # Basic state heuristic
            "dur": round(dur, 6),
            "sbytes": self.sbytes,
            "dbytes": self.dbytes,
            "sttl": int(self.sttl_sum / self.spkts),
            "dttl": int(self.dttl_sum / self.dpkts) if self.dpkts > 0 else 0,
            "service": "dns" if (self.src_port == 53 or self.dst_port == 53) else "http" if (self.src_port == 80 or self.dst_port == 80) else "ssl" if (self.src_port == 443 or self.dst_port == 443) else "none",
            "sload": round((self.sbytes * 8) / dur, 4),
            "dload": round((self.dbytes * 8) / dur, 4),
            "spkts": self.spkts,
            "dpkts": self.dpkts,
            "dwin": self.flags['ack'] * 255 if self.protocol == 6 else 0, # Placeholder for window size logic
            "stcpb": 0, # Stream index placeholders
            "dtcpb": 0,
            "trans_depth": 1 if (self.src_port == 80 or self.dst_port == 80) else 0,
            "res_bdy_len": 0,
            "sjit": round(self.iat_fwd.std, 6),
            "djit": round(self.iat_bwd.std, 6),
            "sintpkt": round(self.iat_fwd.mean, 6),
            "dintpkt": round(self.iat_bwd.mean, 6),
            "tcprtt": 0, # RTT placeholders (requires sequence tracking)
            "synack": 0,
            "ackdat": 0,
            "is_sm_ips_ports": 1 if (self.src_ip == self.dst_ip and self.src_port == self.dst_port) else 0,
            "ct_state_ttl": 0, # Placeholders for complex tracking features
            "ct_flw_http_mthd": 0,
            "is_ftp_login": 0,
            "ct_ftp_cmd": 0,
            "ct_srv_src": 1,
            "ct_srv_dst": 1,
            "ct_dst_ltm": 1,
            "ct_src_ltm": 1,
            "ct_src_dport_ltm": 1,
            "ct_dst_sport_ltm": 1,
            "ct_dst_src_ltm": 1
        }


# ══════════════════════════════════════════════════════════════════════════════
#  STREAMING PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def extract_features_from_pcap(
    filepath: str,
    scaler_path: str = "models/scaler.pkl",
    flow_timeout: float = 120.0,
    feature_list: list[str] = None,
    encoders: dict = None,
) -> tuple[np.ndarray, np.ndarray, pd.DataFrame, dict]:
    """Streaming entry point: .pcap -> (scaled, raw, meta, summary)"""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"PCAP file not found: {filepath}")

    t_start = time.perf_counter()
    active_flows: dict[tuple, FlowRecord] = {}
    completed_features = []
    pkt_count = 0
    skipped = 0

    with open(filepath, "rb") as f:
        # Determine opener
        magic = f.read(4)
        f.seek(0)
        opener = dpkt.pcapng.Reader if magic == b"\x0a\x0d\x0d\x0a" else dpkt.pcap.Reader
        
        try:
            pcap = opener(f)
        except Exception as e:
            raise ValueError(f"Cannot open PCAP file: {e}")

        for ts, raw_buf in pcap:
            pkt_count += 1
            try:
                ip = None
                try:
                    eth = dpkt.ethernet.Ethernet(raw_buf)
                    ip = eth.data
                except Exception:
                    pass
                
                if not isinstance(ip, dpkt.ip.IP):
                    try:
                        ip = dpkt.ip.IP(raw_buf)
                    except Exception:
                        if len(raw_buf) > 16:
                            try:
                                ip = dpkt.ip.IP(raw_buf[16:])
                            except Exception:
                                pass
                
                if not isinstance(ip, dpkt.ip.IP):
                    raise ValueError(f"Unsupported packet type: {type(ip).__name__ if ip else 'None'}")
                
                src_ip = socket.inet_ntoa(ip.src)
                dst_ip = socket.inet_ntoa(ip.dst)
                
                proto = ip.p
                transport = ip.data
                src_port = dst_port = tcp_flags = 0
                
                if isinstance(transport, dpkt.tcp.TCP):
                    src_port, dst_port, tcp_flags = transport.sport, transport.dport, transport.flags
                elif isinstance(transport, dpkt.udp.UDP):
                    src_port, dst_port = transport.sport, transport.dport

                pkt = {
                    "timestamp": float(ts), "src_ip": src_ip, "dst_ip": dst_ip,
                    "src_port": src_port, "dst_port": dst_port, "protocol": proto,
                    "ip_len": ip.len, "ttl": ip.ttl, "tcp_flags": tcp_flags
                }

                # Progress Logging for large files
                if pkt_count % 25000 == 0:
                    logger.info(f"Processed {pkt_count:,} packets... ({len(active_flows)} active flows)")

                # Flow Management
                key = _make_key(pkt)
                if key in active_flows:
                    flow = active_flows[key]
                    if (ts - flow.last_ts) > flow_timeout:
                        completed_features.append(flow.to_feature_dict())
                        active_flows[key] = FlowRecord(pkt)
                    else:
                        flow.update(pkt)
                else:
                    active_flows[key] = FlowRecord(pkt)

                # Periodic Cleanup (Every 100k packets) to keep RAM low
                if pkt_count % 100000 == 0:
                    expired = [k for k, v in active_flows.items() if (ts - v.last_ts) > flow_timeout]
                    for k in expired:
                        completed_features.append(active_flows.pop(k).to_feature_dict())

            except Exception as e:
                skipped += 1
                if skipped <= 3:
                    logger.debug(f"Skipped packet #{pkt_count}: {type(e).__name__}: {e}")
                continue

    # Flush remaining flows
    for flow in active_flows.values():
        if (flow.spkts + flow.dpkts) >= 1: # Min packets to be useful
            completed_features.append(flow.to_feature_dict())

    if not completed_features:
        raise RuntimeError(
            f"No valid flows found. Processed {pkt_count} packets, skipped {skipped} (likely non-IPv4 or unsupported link-layer). "
            "Ensure your PCAP contains IPv4 traffic."
        )

    # Model Compatibility Layer
    X_scaled, X_raw, df_meta = prepare_for_model(completed_features, scaler_path, feature_list, encoders)

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)
    summary = {
        "total_packets": pkt_count, "total_flows": len(completed_features),
        "feature_count": X_scaled.shape[1], "processing_ms": elapsed_ms,
        "feature_names": list(X_raw.columns) if isinstance(X_raw, pd.DataFrame) else MODEL_FEATURES
    }

    return X_scaled, X_raw, df_meta, summary


def _make_key(pkt: dict) -> tuple:
    ep_a = (pkt["src_ip"], pkt["src_port"])
    ep_b = (pkt["dst_ip"], pkt["dst_port"])
    if ep_a > ep_b: ep_a, ep_b = ep_b, ep_a
    return (*ep_a, *ep_b, pkt["protocol"])


def prepare_for_model(feature_dicts, scaler_path, feature_list=None, encoders=None):
    """Convert dictionaries to scaled and raw matrices."""
    if feature_list is None: feature_list = MODEL_FEATURES
    df = pd.DataFrame(feature_dicts)
    
    # ── 1. Categorical Encoding (on a copy for X) ────────────────────────
    X = df.reindex(columns=feature_list, fill_value=0)
    
    # Convert proto number to name for encoding
    if 'proto' in X.columns:
        proto_map = {'6': 'tcp', '17': 'udp', '1': 'icmp', '47': 'gre', '50': 'esp', '51': 'ah', '89': 'ospf', '132': 'sctp'}
        X['proto'] = X['proto'].astype(str).map(lambda x: proto_map.get(x, x))
    
    if encoders:
        for col, encoder in encoders.items():
            if col in X.columns and col in ['proto', 'service', 'state']:
                try:
                    # Convert to string and match encoder's expected format
                    X[col] = X[col].astype(str).str.upper()  # Encoder expects uppercase for state
                    known = set(encoder.classes_)
                    X[col] = X[col].apply(lambda x: x if x in known else encoder.classes_[0])
                    X[col] = encoder.transform(X[col])
                except Exception as e:
                    logger.warning(f"Encoding failed for {col}: {e}. Filling with 0.")
                    X[col] = 0

    X = X.astype(float)
    X.replace([np.inf, -np.inf], 0, inplace=True)
    X.fillna(0, inplace=True)

    X_raw = X.copy() # Store encoded but unscaled features

    if os.path.exists(scaler_path):
        with open(scaler_path, "rb") as f: scaler = pickle.load(f)
        X_scaled = scaler.transform(X.values)
    else:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X.values)
        os.makedirs(os.path.dirname(scaler_path), exist_ok=True)
        with open(scaler_path, "wb") as f: pickle.dump(scaler, f)
            
    meta_cols = [c for c in df.columns if c.startswith("_")]
    df_meta = df[meta_cols].copy()
    
    return X_scaled, X_raw, df_meta
