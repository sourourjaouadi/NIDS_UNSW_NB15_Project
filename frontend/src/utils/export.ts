import { FlowRecord } from "../types/nids";

const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const downloadFlowsAsCsv = (flows: FlowRecord[]) => {
  const header = [
    "Flow ID",
    "Source IP",
    "Destination IP",
    "Protocol",
    "Packet Count",
    "Bytes",
    "Duration Seconds",
    "Prediction",
    "Attack Family",
    "Confidence"
  ];

  const rows = flows.map((flow) => [
    flow.id,
    flow.sourceIp,
    flow.destIp,
    flow.protocol,
    flow.packetCount,
    flow.bytes,
    flow.duration,
    flow.prediction,
    flow.attackFamily,
    flow.confidence.toFixed(1)
  ]);

  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "smart-nids-flow-results.csv";
  link.click();
  URL.revokeObjectURL(url);
};
