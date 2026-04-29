import { useEffect, useRef, useState } from "react";
import { mapAnalysisToFlows, uploadPcap } from "./api/pcap";
import { AmbientBackground } from "./components/AmbientBackground";
import { ChartsSection } from "./components/ChartsSection";
import { Chatbot } from "./components/Chatbot";
import { FlowTable } from "./components/FlowTable";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { StatisticsCards } from "./components/StatisticsCards";
import { ToastViewport } from "./components/ToastViewport";
import { UploadPanel } from "./components/UploadPanel";
import { FeaturesTable } from "./components/FeaturesTable";
import { ExtractionBreakdown } from "./components/ExtractionBreakdown";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { CumulativeDashboard } from "./components/CumulativeDashboard";
import { useFileUpload } from "./hooks/useFileUpload";
import { useToast } from "./hooks/useToast";
import { FlowRecord } from "./types/nids";
import { downloadFlowsAsCsv } from "./utils/export";

interface SessionSummary {
  id: string;
  source: string;
  flowCount: number;
  uploadedAt: string;
}

const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.trim());
};

const parseCsvToFlows = async (file: File): Promise<FlowRecord[]> => {
  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => headers.indexOf(name.toLowerCase());
  const iFlowId = idx("flow id");
  const iSource = idx("source ip");
  const iDest = idx("destination ip");
  const iProto = idx("protocol");
  const iPackets = idx("packet count");
  const iBytes = idx("bytes");
  const iDuration = idx("duration seconds");
  const iPrediction = idx("prediction");
  const iAttack = idx("attack family");
  const iConfidence = idx("confidence");

  return lines.slice(1).map((line, rowIndex) => {
    const row = parseCsvLine(line);
    const predictionRaw = (iPrediction >= 0 ? row[iPrediction] : "Suspicious") || "Suspicious";
    const prediction =
      predictionRaw === "Benign" || predictionRaw === "Malicious" || predictionRaw === "Suspicious"
        ? predictionRaw
        : "Suspicious";

    return {
      id: (iFlowId >= 0 ? row[iFlowId] : "") || `csv-flow-${rowIndex + 1}`,
      sourceIp: (iSource >= 0 ? row[iSource] : "") || "0.0.0.0",
      destIp: (iDest >= 0 ? row[iDest] : "") || "0.0.0.0",
      protocol: ((iProto >= 0 ? row[iProto] : "") || "UNK").toUpperCase(),
      packetCount: Number(iPackets >= 0 ? row[iPackets] : 0) || 0,
      bytes: Number(iBytes >= 0 ? row[iBytes] : 0) || 0,
      duration: Number(iDuration >= 0 ? row[iDuration] : 0) || 0,
      prediction,
      attackFamily: (iAttack >= 0 ? row[iAttack] : "") || (prediction === "Benign" ? "Normal" : "Unknown"),
      timestamp: new Date().toISOString(),
      confidence: Number(iConfidence >= 0 ? row[iConfidence] : 50) || 50,
      summary: "Loaded from CSV session file.",
      recommendations: prediction === "Benign" ? ["No action required."] : ["Review flow details and investigate source host."],
      shapFeatures: []
    };
  });
};

function App() {
  const uploadRef = useRef<HTMLDivElement | null>(null);
  const flowsRef = useRef<HTMLDivElement | null>(null);
  const extractionRef = useRef<HTMLDivElement | null>(null);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [extractionResults, setExtractionResults] = useState<{ names: string[]; data: number[][] }>({ names: [], data: [] });
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const { pushToast } = useToast();

  const { files, queueFiles, setFileProgress, markFileReady, markFileError } = useFileUpload({
    onAccept: async (file, queuedFile) => {
      pushToast({
        title: "Upload started",
        message: `${file.name} is being sent to the backend pipeline for flow extraction and scoring.`,
        tone: "info"
      });

      try {
        const ext = file.name.split(".").pop()?.toLowerCase();
        let mappedFlows: FlowRecord[] = [];
        let flowCount = 0;

        if (ext === "csv") {
          setFileProgress(queuedFile.id, 100, "analyzing");
          mappedFlows = await parseCsvToFlows(file);
          flowCount = mappedFlows.length;
        } else {
          const analysis = await uploadPcap(file, (progress) => {
            setFileProgress(queuedFile.id, progress, progress >= 100 ? "analyzing" : "uploading");
          });

          mappedFlows = mapAnalysisToFlows(analysis, file.name);
          flowCount = analysis.flow_count;
          setExtractionResults({ names: analysis.feature_names || [], data: analysis.raw_features || [] });
          setFeaturesExpanded(true); // Auto-expand on success
          
          // Auto-scroll after a short delay to allow rendering
          setTimeout(() => extractionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        }

        setFlows((current) => [...mappedFlows, ...current]);
        setSessions((current) => [
          {
            id: queuedFile.id,
            source: file.name,
            flowCount,
            uploadedAt: new Date().toISOString()
          },
          ...current
        ]);
        setSelectedFlow(mappedFlows[0] ?? null);
        markFileReady(queuedFile.id);
        setBackendOnline(true);

        pushToast({
          title: "Analysis ready",
          message: `${file.name} appended ${flowCount} flow${flowCount === 1 ? "" : "s"} to cumulative history.`,
          tone: "success"
        });

        flowsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        markFileError(queuedFile.id);

        pushToast({
          title: "Upload failed",
          message: error instanceof Error ? error.message : `Failed to analyze ${file.name}.`,
          tone: "danger"
        });
      }
    },
    onError: (title, message) =>
      pushToast({
        title,
        message,
        tone: "danger"
      })
  });

  useEffect(() => {
    // Demo data loading disabled as per user request
    setBackendOnline(true); // Assume online or let health check handle it
  }, []);

  const scrollToUpload = () => uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToFlows = () => flowsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const clearHistory = () => {
    setFlows([]);
    setSessions([]);
    setSelectedFlow(null);
    setExtractionResults({ names: [], data: [] });
    setFeaturesExpanded(false);
    pushToast({
      title: "History cleared",
      message: "All cumulative sessions and flow results were reset.",
      tone: "warning"
    });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-nids-bg text-slate-100">
      <AmbientBackground />
      <ToastViewport />
      <Header onUploadClick={scrollToUpload} backendOnline={backendOnline} />

      <main className="relative z-10">
        <HeroSection onUploadClick={scrollToUpload} onResultsClick={scrollToFlows} flows={flows} backendOnline={backendOnline} />
        <CumulativeDashboard flows={flows} sessions={sessions} onClearHistory={clearHistory} />
        <StatisticsCards flows={flows} />
        <div ref={uploadRef}>
          <UploadPanel files={files} onFilesSelected={queueFiles} />
        </div>
        <div ref={extractionRef}>
          <FeaturesTable 
            featureNames={extractionResults.names} 
            rawFeatures={extractionResults.data} 
            isExpanded={featuresExpanded}
            onToggle={() => setFeaturesExpanded(!featuresExpanded)}
          />
        </div>
        <ChartsSection flows={flows} />
        <AnalyticsPanel flows={flows} />
        <div ref={flowsRef}>
          <FlowTable
            flows={flows}
            selectedFlowId={selectedFlow?.id}
            onSelectFlow={setSelectedFlow}
            onExport={() => {
              downloadFlowsAsCsv(flows);
              pushToast({
                title: "CSV exported",
                message: "Flow predictions were downloaded as smart-nids-flow-results.csv.",
                tone: "success"
              });
            }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
           <ExtractionBreakdown flow={selectedFlow} />
        </div>
      </main>

      <Footer />
      <Chatbot flows={flows} selectedFlow={selectedFlow} />
    </div>
  );
}

export default App;
