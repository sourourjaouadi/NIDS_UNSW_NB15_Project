import { motion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  TriangleAlert,
  UploadCloud
} from "lucide-react";
import { useRef, useState } from "react";
import { UploadedFile } from "../types/nids";
import { formatBytes } from "../utils/format";

interface UploadPanelProps {
  files: UploadedFile[];
  onFilesSelected: (files: FileList | File[]) => void;
}

const statusMap = {
  uploading: {
    label: "Uploading",
    icon: LoaderCircle,
    className: "text-cyan-300"
  },
  analyzing: {
    label: "Analyzing",
    icon: LoaderCircle,
    className: "text-amber-300"
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    className: "text-emerald-300"
  },
  error: {
    label: "Error",
    icon: TriangleAlert,
    className: "text-rose-300"
  }
} as const;

export const UploadPanel = ({ files, onFilesSelected }: UploadPanelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      onFilesSelected(event.dataTransfer.files);
    }
  };

  return (
    <section id="upload" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">CSV Ingestion</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-white">Upload and analyze flow files</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Drag CICFlowMeter CSV files directly into the platform or browse from disk. Each row is validated,
                scaled, scored, and returned as flow analytics with analyst-friendly detail.
              </p>
            </div>
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-3">
              <UploadCloud className="h-5 w-5 text-cyan-300" />
            </div>
          </div>

          <motion.div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            animate={{
              scale: isDragging ? 1.01 : 1,
              borderColor: isDragging ? "rgba(15,195,255,0.45)" : "rgba(255,255,255,0.08)"
            }}
            className="relative mt-8 rounded-[28px] border border-dashed bg-[#0B1320]/80 p-8"
          >
            <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <UploadCloud className="h-8 w-8 text-cyan-300" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-white">Drop `.csv` files here</h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-400">
                CICFlowMeter CSV - one row per network flow, 38 feature columns.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-cyan-300"
                >
                  Select files
                </button>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  Secure upload window - Max 2 GB
                </span>
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) {
                  onFilesSelected(event.target.files);
                  event.target.value = "";
                }
              }}
            />
          </motion.div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Upload Queue</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">CSV files</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              {files.length} file{files.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {files.map((file) => {
              const StatusIcon = statusMap[file.status].icon;

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-white/8 bg-[#0B1320]/80 p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-3">
                      <FileText className="h-5 w-5 text-cyan-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">
                            {file.extension} - {formatBytes(file.size)}
                          </p>
                        </div>
                        <div className={`flex items-center gap-2 text-xs font-semibold ${statusMap[file.status].className}`}>
                          <StatusIcon
                            className={`h-4 w-4 ${file.status === "uploading" || file.status === "analyzing" ? "animate-spin" : ""}`}
                          />
                          {statusMap[file.status].label}
                        </div>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-full bg-white/6">
                        <motion.div
                          className="relative h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-200"
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                        >
                          <span className="absolute inset-y-0 left-0 w-24 animate-sheen bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        </motion.div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{file.progress}% complete</span>
                        <span>{file.status === "ready" ? "Flows extracted" : "Preparing results dashboard"}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
