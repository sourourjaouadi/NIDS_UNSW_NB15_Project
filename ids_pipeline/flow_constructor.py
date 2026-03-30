from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterable

try:
    from ids_pipeline.pcap_parser import PacketRecord
except ImportError:  # pragma: no cover
    from pcap_parser import PacketRecord


@dataclass
class RawFlow:
    flow_id: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    service: str
    start_time: datetime
    end_time: datetime
    src_packets: int = 0
    dst_packets: int = 0
    src_bytes: int = 0
    dst_bytes: int = 0
    src_ttls: list[int] = field(default_factory=list)
    dst_ttls: list[int] = field(default_factory=list)
    tcp_flags: list[str] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return max((self.end_time - self.start_time).total_seconds(), 0.0)

    @property
    def total_packets(self) -> int:
        return self.src_packets + self.dst_packets

    @property
    def total_bytes(self) -> int:
        return self.src_bytes + self.dst_bytes


def _canonical_key(packet: PacketRecord) -> tuple[tuple[str, int], tuple[str, int], str]:
    endpoints = sorted(
        ((packet.src_ip, packet.src_port), (packet.dst_ip, packet.dst_port)),
        key=lambda value: (value[0], value[1]),
    )
    return endpoints[0], endpoints[1], packet.protocol.upper()


def _flow_state(flow: RawFlow) -> str:
    flags = "".join(flow.tcp_flags).lower()
    if "04" in flags or "rst" in flags:
        return "rst"
    if "01" in flags or "fin" in flags:
        return "fin"
    if flow.protocol.upper() in {"UDP", "DNS"}:
        return "req"
    if flow.duration == 0 and flow.total_packets <= 1:
        return "int"
    return "con"


def build_flows(packets: Iterable[PacketRecord]) -> list[RawFlow]:
    flows: dict[tuple[tuple[str, int], tuple[str, int], str], RawFlow] = {}

    for packet in sorted(packets, key=lambda item: item.timestamp):
        key = _canonical_key(packet)

        if key not in flows:
            flows[key] = RawFlow(
                flow_id=f"FLOW-{len(flows) + 1:05d}",
                src_ip=packet.src_ip,
                dst_ip=packet.dst_ip,
                src_port=packet.src_port,
                dst_port=packet.dst_port,
                protocol=packet.protocol.upper(),
                service=packet.service,
                start_time=packet.timestamp,
                end_time=packet.timestamp,
            )

        flow = flows[key]
        flow.end_time = max(flow.end_time, packet.timestamp)
        if packet.tcp_flags:
            flow.tcp_flags.append(packet.tcp_flags)

        is_forward = (
            packet.src_ip == flow.src_ip
            and packet.dst_ip == flow.dst_ip
            and packet.src_port == flow.src_port
            and packet.dst_port == flow.dst_port
        )

        if is_forward:
            flow.src_packets += 1
            flow.src_bytes += packet.length
            if packet.ttl:
                flow.src_ttls.append(packet.ttl)
        else:
            flow.dst_packets += 1
            flow.dst_bytes += packet.length
            if packet.ttl:
                flow.dst_ttls.append(packet.ttl)

    finalized = list(flows.values())
    for flow in finalized:
        flow.service = flow.service or "unknown"
        flow.protocol = flow.protocol or "OTHER"
        setattr(flow, "state", _flow_state(flow))

    return finalized

