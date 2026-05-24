export type PredictionClass = "Normal" | "Attack";

export interface ShapFeature {
  name: string;
  rawValue: string;
  impact: number;
  plainEnglish: string;
  shapValue?: number;
  direction?: "toward_attack" | "toward_normal";
}

export interface FlowRecord {
  id: string;
  sessionId?: string;
  backendFlowId?: string;
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

export interface ApiAnalysisResponse {
  session_id?: string;
  source: string;
  generated_at: string;
  packet_count: number;
  flow_count: number;
  feature_names: string[];
  raw_features: number[][];
  scaled_features: number[][];
  predictions: any[]; 
}
