from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable

try:
    import pyshark  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    pyshark = None

try:
    from ids_pipeline.config import SERVICE_PORT_MAP
except ImportError:  # pragma: no cover
    from config import SERVICE_PORT_MAP


@dataclass
class PacketRecord:
    timestamp: datetime
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    length: int
    ttl: int
    tcp_flags: str
    service: str


def guess_service(src_port: int, dst_port: int, protocol: str) -> str:
    if protocol.upper() == "ICMP":
        return "icmp"

    for port in (dst_port, src_port):
        if port in SERVICE_PORT_MAP:
            return SERVICE_PORT_MAP[port]

    return "unknown"


def _normalize_protocol(packet: object) -> str:
    layer = getattr(packet, "transport_layer", None)
    highest = str(getattr(packet, "highest_layer", "OTHER")).upper()

    if layer:
        layer_name = str(layer).upper()
        if layer_name == "TCP" and getattr(packet, "tcp", None):
            ports = {getattr(packet.tcp, "srcport", ""), getattr(packet.tcp, "dstport", "")}
            if "443" in ports:
                return "TLS"
        return layer_name

    if highest in {"DNS", "HTTP", "HTTPS", "ICMP"}:
        return highest

    return "OTHER"


def parse_pcap(path: str | Path) -> list[PacketRecord]:
    if pyshark is None:
        raise RuntimeError(
            "pyshark is not installed. Install requirements.txt to enable real PCAP parsing."
        )

    capture = pyshark.FileCapture(str(path), keep_packets=False)
    packets: list[PacketRecord] = []

    try:
        for packet in capture:
            ip_layer = getattr(packet, "ip", None) or getattr(packet, "ipv6", None)
            if ip_layer is None:
                continue

            protocol = _normalize_protocol(packet)
            transport = getattr(packet, "tcp", None) or getattr(packet, "udp", None)
            src_port = int(getattr(transport, "srcport", 0) or 0)
            dst_port = int(getattr(transport, "dstport", 0) or 0)
            ttl = int(getattr(ip_layer, "ttl", 0) or 0)
            length = int(getattr(packet, "length", 0) or 0)
            tcp_flags = str(getattr(getattr(packet, "tcp", None), "flags", "") or "")
            service = guess_service(src_port, dst_port, protocol)

            packets.append(
                PacketRecord(
                    timestamp=packet.sniff_time,
                    src_ip=str(getattr(ip_layer, "src")),
                    dst_ip=str(getattr(ip_layer, "dst")),
                    src_port=src_port,
                    dst_port=dst_port,
                    protocol=protocol,
                    length=length,
                    ttl=ttl,
                    tcp_flags=tcp_flags,
                    service=service,
                )
            )
    finally:
        capture.close()

    return packets


def demo_packets() -> list[PacketRecord]:
    start = datetime(2026, 3, 30, 10, 0, 0)
    packet_specs = [
        ("10.0.0.14", "172.16.0.9", 51514, 443, "TLS", 1100, 64, "0x0018"),
        ("172.16.0.9", "10.0.0.14", 443, 51514, "TLS", 880, 57, "0x0018"),
        ("203.0.113.4", "10.20.1.8", 45511, 80, "TCP", 1500, 248, "0x0018"),
        ("203.0.113.4", "10.20.1.8", 45511, 80, "TCP", 1510, 248, "0x0018"),
        ("203.0.113.4", "10.20.1.8", 45511, 80, "TCP", 1520, 247, "0x0018"),
        ("10.33.8.5", "10.33.8.1", 53332, 53, "DNS", 210, 64, ""),
        ("10.33.8.1", "10.33.8.5", 53, 53332, "DNS", 340, 64, ""),
        ("198.51.100.20", "10.20.9.12", 60000, 22, "TCP", 120, 251, "0x0002"),
        ("198.51.100.20", "10.20.9.12", 60000, 22, "TCP", 120, 251, "0x0002"),
        ("198.51.100.20", "10.20.9.12", 60000, 22, "TCP", 120, 251, "0x0002"),
    ]

    packets: list[PacketRecord] = []
    for index, spec in enumerate(packet_specs):
        src_ip, dst_ip, src_port, dst_port, protocol, length, ttl, flags = spec
        packets.append(
            PacketRecord(
                timestamp=start + timedelta(milliseconds=index * 120),
                src_ip=src_ip,
                dst_ip=dst_ip,
                src_port=src_port,
                dst_port=dst_port,
                protocol=protocol,
                length=length,
                ttl=ttl,
                tcp_flags=flags,
                service=guess_service(src_port, dst_port, protocol),
            )
        )

    return packets


def packets_to_dicts(packets: Iterable[PacketRecord]) -> list[dict[str, object]]:
    return [
        {
            "timestamp": packet.timestamp.isoformat(),
            "src_ip": packet.src_ip,
            "dst_ip": packet.dst_ip,
            "src_port": packet.src_port,
            "dst_port": packet.dst_port,
            "protocol": packet.protocol,
            "length": packet.length,
            "ttl": packet.ttl,
            "tcp_flags": packet.tcp_flags,
            "service": packet.service,
        }
        for packet in packets
    ]

