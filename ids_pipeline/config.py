from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent
ARTIFACTS_DIR = PACKAGE_ROOT / "artifacts"
RF_MODEL_PATH = ARTIFACTS_DIR / "rf_model.pkl"
XGB_MODEL_PATH = ARTIFACTS_DIR / "xgb_model.pkl"

UPLOAD_MAX_BYTES = 100 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".pcap", ".pcapng"}
SUPPORTED_PROTOCOLS = {"TCP", "UDP", "ICMP", "TLS", "DNS", "HTTP", "HTTPS", "OTHER"}

SERVICE_PORT_MAP = {
    20: "ftp-data",
    21: "ftp",
    22: "ssh",
    25: "smtp",
    53: "dns",
    80: "http",
    110: "pop3",
    123: "ntp",
    143: "imap",
    161: "snmp",
    389: "ldap",
    443: "https",
    445: "smb",
    3389: "rdp",
}

CATEGORICAL_ENCODINGS = {
    "proto": {
        "tcp": 1,
        "udp": 2,
        "icmp": 3,
        "tls": 4,
        "dns": 5,
        "http": 6,
        "https": 7,
        "other": 0,
    },
    "service": {
        "dns": 1,
        "http": 2,
        "https": 3,
        "ftp": 4,
        "ftp-data": 5,
        "ssh": 6,
        "smtp": 7,
        "pop3": 8,
        "imap": 9,
        "ntp": 10,
        "snmp": 11,
        "ldap": 12,
        "smb": 13,
        "rdp": 14,
        "icmp": 15,
        "unknown": 0,
    },
    "state": {
        "con": 1,
        "fin": 2,
        "int": 3,
        "req": 4,
        "rst": 5,
        "other": 0,
    },
}

FEATURE_COLUMNS = [
    "dur",
    "spkts",
    "dpkts",
    "sbytes",
    "dbytes",
    "sttl",
    "dttl",
    "sload",
    "dload",
    "ct_state_ttl",
    "ct_srv_src",
    "ct_srv_dst",
    "ct_dst_ltm",
    "ct_src_dport_ltm",
    "ct_dst_src_ltm",
    "proto_enc",
    "service_enc",
    "state_enc",
]

NUMERIC_DEFAULTS = {
    "dur": 0.0,
    "spkts": 0.0,
    "dpkts": 0.0,
    "sbytes": 0.0,
    "dbytes": 0.0,
    "sttl": 0.0,
    "dttl": 0.0,
    "sload": 0.0,
    "dload": 0.0,
    "ct_state_ttl": 0.0,
    "ct_srv_src": 0.0,
    "ct_srv_dst": 0.0,
    "ct_dst_ltm": 0.0,
    "ct_src_dport_ltm": 0.0,
    "ct_dst_src_ltm": 0.0,
}

LOG_SCALE_COLUMNS = {
    "dur",
    "spkts",
    "dpkts",
    "sbytes",
    "dbytes",
    "sload",
    "dload",
    "ct_state_ttl",
    "ct_srv_src",
    "ct_srv_dst",
    "ct_dst_ltm",
    "ct_src_dport_ltm",
    "ct_dst_src_ltm",
}

ATTACK_LABELS = [
    "Benign",
    "Suspicious",
    "Malicious",
]


@dataclass(frozen=True)
class ModelArtifact:
    name: str
    path: Path


MODEL_ARTIFACTS = (
    ModelArtifact(name="random_forest", path=RF_MODEL_PATH),
    ModelArtifact(name="xgboost", path=XGB_MODEL_PATH),
)

