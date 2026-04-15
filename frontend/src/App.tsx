import { useEffect, useRef, useState } from "react";
import { fetchDemoAnalysis, mapAnalysisToFlows, uploadPcap } from "./api/pcap";
import { AmbientBackground } from "./components/AmbientBackground";
import { ChartsSection } from "./components/ChartsSection";
import { Chatbot } from "./components/Chatbot";
import { FlowDetailDrawer } from "./components/FlowDetailDrawer";
import { FlowTable } from "./components/FlowTable";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { StatisticsCards } from "./components/StatisticsCards";
import { ToastViewport } from "./components/ToastViewport";
import { UploadPanel } from "./components/UploadPanel";
import { FeaturesTable } from "./components/FeaturesTable";
import { ExtractionBreakdown } from "./components/ExtractionBreakdown";
import { useFileUpload } from "./hooks/useFileUpload";
import { useToast } from "./hooks/useToast";
import { FlowRecord } from "./types/nids";
import { downloadFlowsAsCsv } from "./utils/export";

const maxVisibleFlows = 50;

function App() {
  const uploadRef = useRef<HTMLDivElement | null>(null);
  const flowsRef = useRef<HTMLDivElement | null>(null);
  const extractionRef = useRef<HTMLDivElement | null>(null);
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord | null>(null);
  const [extractionResults, setExtractionResults] = useState<{ names: string[]; data: number[][] }>({ names: [], data: [] });
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const { pushToast } = useToast();

  const { files, queueFiles, setFileProgress, markFileReady, markFileError } = useFileUpload({
    onAccept: async (file, queuedFile) => {
      pushToast({
        title: "Upload started",
        message: `${file.name} is being sent to the FastAPI pipeline for flow extraction and scoring.`,
        tone: "info"
      });

      try {
        const analysis = await uploadPcap(file, (progress) => {
          setFileProgress(queuedFile.id, progress, progress >= 100 ? "analyzing" : "uploading");
        });

        const mappedFlows = mapAnalysisToFlows(analysis, file.name);
        setFlows((current) => [...mappedFlows, ...current].slice(0, maxVisibleFlows));
        setExtractionResults({ names: analysis.feature_names || [], data: analysis.raw_features || [] });
        setFeaturesExpanded(true); // Auto-expand on success
        
        // Auto-scroll after a short delay to allow rendering
        setTimeout(() => extractionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        
        setSelectedFlow(mappedFlows[0] ?? null);
        markFileReady(queuedFile.id);
        setBackendOnline(true);

        pushToast({
          title: "Analysis ready",
          message: `${file.name} produced ${analysis.flow_count} extracted flow${analysis.flow_count === 1 ? "" : "s"}.`,
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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-nids-bg text-slate-100">
      <AmbientBackground />
      <ToastViewport />
      <Header onUploadClick={scrollToUpload} backendOnline={backendOnline} />

      <main className="relative z-10">
        <HeroSection onUploadClick={scrollToUpload} onResultsClick={scrollToFlows} flows={flows} backendOnline={backendOnline} />
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
      <FlowDetailDrawer
        flow={selectedFlow}
        onClose={() => setSelectedFlow(null)}
        onCopy={(message) =>
          pushToast({
            title: "Clipboard",
            message,
            tone: message.toLowerCase().includes("failed") ? "danger" : "success"
          })
        }
      />
      <Chatbot flows={flows} selectedFlow={selectedFlow} />
    </div>
  );
}

export default App;
