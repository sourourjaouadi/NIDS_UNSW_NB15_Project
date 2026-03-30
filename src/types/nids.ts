export type PredictionClass = "Benign" | "Malicious" | "Suspicious";

export interface ShapFeature {
  name: string;
  rawValue: string;
  impact: number;
  plainEnglish: string;
}

export interface FlowRecord {
  id: string;
  sourceIp: string;
  destIp: string;
  protocol: string;
  packetCount: number;
  bytes: number;
  duration: number;
  prediction: PredictionClass;
  attackFamily: string;
  timestamp: string;
  confidence: number;
  summary: string;
  recommendations: string[];
  shapFeatures: ShapFeature[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  extension: string;
  progress: number;
  status: "uploading" | "analyzing" | "ready" | "error";
}

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  tone: "info" | "success" | "warning" | "danger";
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}
