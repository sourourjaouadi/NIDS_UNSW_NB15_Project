from __future__ import annotations

from collections import Counter
from typing import Iterable

try:
    from ids_pipeline.flow_constructor import RawFlow
except ImportError:  # pragma: no cover
    from flow_constructor import RawFlow


def _average(values: list[int]) -> float:
    return sum(values) / len(values) if values else 0.0


def engineer_features(flows: Iterable[RawFlow]) -> list[dict[str, object]]:
    flow_list = list(flows)
    service_src_counter = Counter((flow.service, flow.src_ip) for flow in flow_list)
    service_dst_counter = Counter((flow.service, flow.dst_ip) for flow in flow_list)
    dst_counter = Counter(flow.dst_ip for flow in flow_list)
    src_dst_counter = Counter((flow.src_ip, flow.dst_ip) for flow in flow_list)
    src_dport_counter = Counter((flow.src_ip, flow.dst_port) for flow in flow_list)
    state_ttl_counter = Counter(
        (
            getattr(flow, "state", "other"),
            round(_average(flow.src_ttls)),
            round(_average(flow.dst_ttls)),
        )
        for flow in flow_list
    )

    engineered_rows: list[dict[str, object]] = []
    for flow in flow_list:
        duration = max(flow.duration, 0.001)
        sttl = _average(flow.src_ttls)
        dttl = _average(flow.dst_ttls)
        state = getattr(flow, "state", "other")

        engineered_rows.append(
            {
                "flow_id": flow.flow_id,
                "src_ip": flow.src_ip,
                "dst_ip": flow.dst_ip,
                "src_port": flow.src_port,
                "dst_port": flow.dst_port,
                "proto": flow.protocol.lower(),
                "service": flow.service.lower(),
                "state": state.lower(),
                "dur": round(duration, 6),
                "spkts": flow.src_packets,
                "dpkts": flow.dst_packets,
                "sbytes": flow.src_bytes,
                "dbytes": flow.dst_bytes,
                "sttl": round(sttl, 2),
                "dttl": round(dttl, 2),
                "sload": round(flow.src_bytes / duration, 4),
                "dload": round(flow.dst_bytes / duration, 4),
                "ct_state_ttl": state_ttl_counter[(state, round(sttl), round(dttl))],
                "ct_srv_src": service_src_counter[(flow.service, flow.src_ip)],
                "ct_srv_dst": service_dst_counter[(flow.service, flow.dst_ip)],
                "ct_dst_ltm": dst_counter[flow.dst_ip],
                "ct_src_dport_ltm": src_dport_counter[(flow.src_ip, flow.dst_port)],
                "ct_dst_src_ltm": src_dst_counter[(flow.src_ip, flow.dst_ip)],
            }
        )

    return engineered_rows

