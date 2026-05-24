import { FlowRecord, PredictionClass } from "../types/nids";

export interface ApiFeatureDriver {
  name: string;
  raw_value: string;
  impact: number;
  plain_english: string;
}

export interface ApiShapFeature {
  feature: string;
  shap_value: number;
  abs_impact: number;
  feature_value: string | number;
  direction: "toward_attack" | "toward_normal";
  semantic: string;
}

export interface ApiPrediction {
  flow_id: string;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  proto: string;
  service: string;
  first_seen: string;
  last_seen: string;
  duration_seconds: number;
  packet_count: number;
  bytes: number;
  risk_score: number;
  predicted_label: string;
  attack_family: string;
  summary: string;
  recommendations: string[];
  top_features: ApiFeatureDriver[];
  shap_top_features?: ApiShapFeature[];
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
  predictions: ApiPrediction[];
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

const buildApiUrl = (path: string) => `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

const extractErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string") {
    return payload.detail;
  }

  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
};

const readJson = async <T>(response: Response, fallback: string): Promise<T> => {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, fallback));
  }

  return payload as T;
};

const normalizePrediction = (prediction: string): PredictionClass => {
  if (prediction === "Normal" || prediction === "Benign") {
    return "Normal";
  }

  return "Attack";
};

const buildFlowIdPrefix = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";

export const mapAnalysisToFlows = (analysis: ApiAnalysisResponse, sourceLabel: string): FlowRecord[] => {
  const idPrefix = buildFlowIdPrefix(sourceLabel);

  return analysis.predictions.map((prediction, index) => {
    const rawVector = analysis.raw_features?.[index] ?? [];
    const scaledVector = analysis.scaled_features?.[index] ?? [];

    const rawFeaturesObj: Record<string, number> = {};
    const scaledFeaturesObj: Record<string, number> = {};

    analysis.feature_names.forEach((name, i) => {
      if (rawVector[i] !== undefined) {
        rawFeaturesObj[name] = rawVector[i];
      }
      if (scaledVector[i] !== undefined) {
        scaledFeaturesObj[name] = scaledVector[i];
      }
    });

    return {
      id: `${idPrefix}-${prediction.flow_id}-${index}`,
      sessionId: analysis.session_id,
      backendFlowId: prediction.flow_id,
      sourceIp: prediction.src_ip,
      destIp: prediction.dst_ip,
      protocol: prediction.proto.toUpperCase(),
      packetCount: prediction.packet_count,
      bytes: prediction.bytes,
      duration: prediction.duration_seconds,
      prediction: normalizePrediction(prediction.predicted_label),
      attackFamily: prediction.attack_family,
      timestamp: prediction.first_seen || analysis.generated_at,
      confidence: Number((prediction.risk_score * 100).toFixed(1)),
      summary: prediction.summary,
      recommendations: prediction.recommendations,
      rawFeatures: rawFeaturesObj,
      scaledFeatures: scaledFeaturesObj,
      shapFeatures: prediction.shap_top_features?.map((feature) => ({
        name: feature.feature,
        rawValue: String(feature.feature_value),
        impact: Math.min(1, feature.abs_impact),
        plainEnglish: feature.semantic,
        shapValue: feature.shap_value,
        direction: feature.direction
      })) ?? prediction.top_features.map((feature) => ({
        name: feature.name,
        rawValue: feature.raw_value,
        impact: feature.impact,
        plainEnglish: feature.plain_english
      }))
    };
  });
};

export const fetchDemoAnalysis = async () => {
  const response = await fetch(buildApiUrl("/predict/demo"));
  return readJson<ApiAnalysisResponse>(response, "Failed to fetch demo analysis from the backend.");
};

export const uploadCsv = (file: File, onProgress?: (progress: number) => void) =>
  new Promise<ApiAnalysisResponse>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", buildApiUrl("/analyze/csv"));
    request.responseType = "json";

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.(progress);
    };

    request.onerror = () => {
      reject(new Error("Network error while uploading the CSV file."));
    };

    request.onload = () => {
      const payload = request.response ?? JSON.parse(request.responseText || "null");

      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve(payload as ApiAnalysisResponse);
        return;
      }

      reject(new Error(extractErrorMessage(payload, "The backend rejected the uploaded CSV file.")));
    };

    request.send(formData);
  });

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export const streamFlowChat = async (
  sessionId: string,
  flowId: string,
  message: string,
  history: ChatHistoryMessage[],
  onDelta: (delta: string) => void
) => {
  const response = await fetch(buildApiUrl(`/chat/${sessionId}/${flowId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history })
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let payload: unknown = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    const detail = extractErrorMessage(payload, text || "Failed to stream chat response.");
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;

      const payload = JSON.parse(line.slice(6));
      if (payload.done) {
        return fullText;
      }
      if (payload.error) {
        throw new Error(payload.error);
      }
      if (payload.text) {
        fullText += payload.text;
        onDelta(payload.text);
      }
    }
  }

  return fullText;
};
