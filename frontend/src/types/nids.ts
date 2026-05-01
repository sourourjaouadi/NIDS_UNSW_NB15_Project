export type PredictionClass = "Benign" | "Malicious" | "Suspicious";

export interface ShapFeature {
  name: string;
  rawValue: string;
  impact: number;
  plainEnglish: string;
}

export interface FlowRecord {
  id: string;
  sessionId?: string;
  sessionSource?: string;
  flowIndex?: number;
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
  rawFeatures?: Record<string, number>;
  scaledFeatures?: Record<string, number>;
  /* ── XGB DUAL MODEL START ── */
  rf?: ModelResult;
  xgb?: ModelResult | null;
  modelsAgree?: boolean;
  /* ── XGB DUAL MODEL END ── */
}

/* ── XGB DUAL MODEL START ── */
export interface ModelResult {
  binary_prediction: "Normal" | "Attack" | string;
  binary_confidence: number;
  multiclass_prediction: string;
  multiclass_confidence: number | null;
}
/* ── XGB DUAL MODEL END ── */

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

export interface ApiAnalysisResponse {
  source: string;
  generated_at: string;
  packet_count: number;
  flow_count: number;
  feature_names: string[];
  raw_features: number[][];
  scaled_features: number[][];
  predictions: any[]; 
}
