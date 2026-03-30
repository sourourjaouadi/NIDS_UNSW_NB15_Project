import { useRef, useState } from "react";
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
import { baseFlows, starterUploads } from "./data/mockData";
import { useFileUpload } from "./hooks/useFileUpload";
import { useToast } from "./hooks/useToast";
import { FlowRecord } from "./types/nids";
import { downloadFlowsAsCsv } from "./utils/export";

const cloneFlowBatch = (batchIndex: number, fileName: string): FlowRecord[] =>
  baseFlows.slice(0, 4).map((flow, index) => ({
    ...flow,
    id: `${flow.id}-${batchIndex}${index}`,
    packetCount: flow.packetCount + batchIndex * 14 + index * 5,
    bytes: flow.bytes + batchIndex * 1800 + index * 420,
    duration: Number((flow.duration + batchIndex * 0.3 + index * 0.2).toFixed(1)),
    timestamp: new Date(Date.parse(flow.timestamp) + batchIndex * 12 * 60 * 1000 + index * 90 * 1000).toISOString(),
    summary: `${flow.summary} Parsed from ${fileName}.`
  }));

function App() {
  const uploadBatchRef = useRef(1);
  const uploadRef = useRef<HTMLDivElement | null>(null);
  const flowsRef = useRef<HTMLDivElement | null>(null);
  const [flows, setFlows] = useState<FlowRecord[]>(baseFlows);
  const [selectedFlow, setSelectedFlow] = useState<FlowRecord | null>(null);
  const { pushToast } = useToast();

  const { files, queueFiles } = useFileUpload({
    initialFiles: starterUploads,
    onAccept: (file) => {
      const batchIndex = uploadBatchRef.current;
      uploadBatchRef.current += 1;

      pushToast({
        title: "PCAP queued",
        message: `${file.name} is being ingested and mapped into flow analytics.`,
        tone: "info"
      });

      window.setTimeout(() => {
        const batch = cloneFlowBatch(batchIndex, file.name);
        setFlows((current) => [...batch, ...current].slice(0, 18));
        setSelectedFlow(batch[0]);
        pushToast({
          title: "Analysis ready",
          message: `${file.name} produced ${batch.length} extracted demo flows and explainability data.`,
          tone: "success"
        });
      }, 1300);
    },
    onError: (title, message) =>
      pushToast({
        title,
        message,
        tone: "danger"
      })
  });

  const scrollToUpload = () => uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToFlows = () => flowsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-nids-bg text-slate-100">
      <AmbientBackground />
      <ToastViewport />
      <Header onUploadClick={scrollToUpload} />

      <main className="relative z-10">
        <HeroSection onUploadClick={scrollToUpload} onResultsClick={scrollToFlows} />
        <StatisticsCards flows={flows} />
        <div ref={uploadRef}>
          <UploadPanel files={files} onFilesSelected={queueFiles} />
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
