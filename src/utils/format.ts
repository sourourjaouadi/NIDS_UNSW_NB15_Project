import { FlowRecord, PredictionClass } from "../types/nids";

export const predictionStyles: Record<
  PredictionClass,
  {
    badge: string;
    row: string;
    dot: string;
  }
> = {
  Benign: {
    badge:
      "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
    row: "hover:bg-emerald-500/6",
    dot: "bg-emerald-400"
  },
  Suspicious: {
    badge:
      "bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/25",
    row: "hover:bg-amber-500/6",
    dot: "bg-amber-400"
  },
  Malicious: {
    badge: "bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/25",
    row: "hover:bg-rose-500/6",
    dot: "bg-rose-400"
  }
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatDuration = (seconds: number) => `${seconds.toFixed(1)}s`;

export const formatTime = (timestamp: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(timestamp));

export const buildExplanation = (flow: FlowRecord) => {
  const topFeatures = flow.shapFeatures
    .slice(0, 3)
    .map((feature) => `${feature.name} (${feature.rawValue})`)
    .join(", ");

  return `${flow.id} was classified as ${flow.prediction.toLowerCase()} (${flow.confidence.toFixed(
    1
  )}% confidence). Primary drivers: ${topFeatures}. Summary: ${flow.summary}`;
};
