import { motion } from "framer-motion";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { FlowRecord, PredictionClass } from "../types/nids";
import { formatBytes, formatDuration, predictionStyles } from "../utils/format";

type SortKey =
  | "id"
  | "sourceIp"
  | "destIp"
  | "protocol"
  | "packetCount"
  | "bytes"
  | "duration"
  | "prediction";

/* ── XGB DUAL MODEL START ── */
type ModelView = "rf" | "xgb" | "compare";
/* ── XGB DUAL MODEL END ── */

interface FlowTableProps {
  flows: FlowRecord[];
  selectedFlowId?: string;
  onSelectFlow: (flow: FlowRecord) => void;
  onExport: () => void;
}

const attackColorMap: Record<string, string> = {
  Fuzzers: "bg-cyan-400 text-cyan-950",
  DoS: "bg-rose-500 text-white",
  Exploits: "bg-orange-400 text-orange-950",
  Reconnaissance: "bg-yellow-300 text-yellow-950",
  Generic: "bg-violet-400 text-violet-950",
  Backdoors: "bg-fuchsia-400 text-fuchsia-950",
  Shellcode: "bg-orange-500 text-white",
  Worms: "bg-lime-400 text-lime-950",
  Analysis: "bg-teal-300 text-teal-950"
};

const attackBarMap: Record<string, string> = {
  Fuzzers: "from-cyan-400 to-cyan-200",
  DoS: "from-rose-500 to-rose-300",
  Exploits: "from-orange-400 to-amber-300",
  Reconnaissance: "from-yellow-300 to-yellow-100",
  Generic: "from-violet-400 to-violet-200",
  Backdoors: "from-fuchsia-400 to-fuchsia-200",
  Shellcode: "from-orange-500 to-rose-400",
  Worms: "from-lime-400 to-lime-200",
  Analysis: "from-teal-300 to-teal-100"
};

const normalizeAttackCategory = (value: string) => {
  const v = value.trim().toLowerCase();
  if (v === "backdoor" || v === "backdoors") return "Backdoors";
  if (v === "dos") return "DoS";
  if (v === "reconnaissance") return "Reconnaissance";
  if (v === "fuzzers") return "Fuzzers";
  if (v === "analysis") return "Analysis";
  if (v === "exploits") return "Exploits";
  if (v === "generic") return "Generic";
  if (v === "shellcode") return "Shellcode";
  if (v === "worms") return "Worms";
  return value;
};

/* ── XGB DUAL MODEL START ── */
const confidencePct = (value?: number | null) => Math.round(((value ?? 0) <= 1 ? (value ?? 0) * 100 : value ?? 0));

const displayModel = (flow: FlowRecord, model: "rf" | "xgb") => {
  const result = model === "rf" ? flow.rf : flow.xgb;
  if (!result) {
    return null;
  }

  return {
    binary: result.binary_prediction,
    binaryConfidence: confidencePct(result.binary_confidence),
    attackType: normalizeAttackCategory(result.multiclass_prediction || "Normal"),
    attackConfidence: confidencePct(result.multiclass_confidence ?? result.binary_confidence)
  };
};

const explainUrl = (flow: FlowRecord, model: "rf" | "xgb") =>
  flow.sessionId && flow.flowIndex !== undefined ? `/api/explain/${flow.sessionId}/${flow.flowIndex}?model=${model}` : "";
/* ── XGB DUAL MODEL END ── */

const columns: Array<{ label: string; key: SortKey }> = [
  { label: "Flow ID", key: "id" },
  { label: "Source IP", key: "sourceIp" },
  { label: "Dest IP", key: "destIp" },
  { label: "Protocol", key: "protocol" },
  { label: "Packet Count", key: "packetCount" },
  { label: "Bytes", key: "bytes" },
  { label: "Duration", key: "duration" },
  { label: "Prediction", key: "prediction" }
];

export const FlowTable = ({ flows, selectedFlowId, onSelectFlow, onExport }: FlowTableProps) => {
  const [search, setSearch] = useState("");
  const [predictionFilter, setPredictionFilter] = useState<PredictionClass | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const protocols = useMemo(() => ["All", ...Array.from(new Set(flows.map((flow) => flow.protocol)))], [flows]);
  const [protocolFilter, setProtocolFilter] = useState("All");
  /* ── XGB DUAL MODEL START ── */
  const [modelView, setModelView] = useState<ModelView>("compare");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const hasXgbGap = flows.some((flow) => !flow.xgb);
  const showXgbNotice = flows.length > 0 && hasXgbGap && !noticeDismissed;
  /* ── XGB DUAL MODEL END ── */

  const filteredFlows = useMemo(() => {
    const query = search.toLowerCase().trim();
    const filtered = flows.filter((flow) => {
      const matchesSearch =
        !query ||
        [flow.id, flow.sourceIp, flow.destIp, flow.protocol, flow.attackFamily]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesPrediction = predictionFilter === "All" || flow.prediction === predictionFilter;
      const matchesProtocol = protocolFilter === "All" || flow.protocol === protocolFilter;

      return matchesSearch && matchesPrediction && matchesProtocol;
    });

    return filtered.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];

      if (typeof left === "number" && typeof right === "number") {
        return sortDirection === "asc" ? left - right : right - left;
      }

      const result = String(left).localeCompare(String(right));
      return sortDirection === "asc" ? result : -result;
    });
  }, [flows, predictionFilter, protocolFilter, search, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <section id="flows" className="mx-auto max-w-7xl px-4 py-10 pb-24 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Flow Results Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Search, sort, and triage extracted flows</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Rows are color-coded by model outcome. Click any flow to open explainability details, recommendations,
              and a copy-ready narrative for analyst handoff.
            </p>
          </div>

          <button
            type="button"
            onClick={onExport}
            disabled={flows.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_0.6fr_0.5fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by flow id, IP, protocol, or attack family"
              className="w-full rounded-2xl border border-white/10 bg-[#0B1320]/80 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/45"
            />
          </label>

          <select
            value={predictionFilter}
            onChange={(event) => setPredictionFilter(event.target.value as PredictionClass | "All")}
            className="rounded-2xl border border-white/10 bg-[#0B1320]/80 px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-300/45"
          >
            <option value="All">All predictions</option>
            <option value="Benign">Benign</option>
            <option value="Suspicious">Suspicious</option>
            <option value="Malicious">Malicious</option>
          </select>

          <select
            value={protocolFilter}
            onChange={(event) => setProtocolFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#0B1320]/80 px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-300/45"
          >
            {protocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {protocol === "All" ? "All protocols" : protocol}
              </option>
            ))}
          </select>
        </div>

        {/* ── XGB DUAL MODEL START ── */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded-full border border-cyan-400/20 bg-[#0B1320]/80 p-1">
            {[
              ["rf", "ðŸŒ² Random Forest"],
              ["xgb", "âš¡ XGBoost"],
              ["compare", "âš– Compare"]
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setModelView(key as ModelView)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  modelView === key
                    ? "bg-cyan-400/20 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.25)]"
                    : "text-slate-400 hover:text-cyan-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {showXgbNotice && (
            <div className="flex items-center gap-3 rounded-full border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100">
              <span>XGBoost results unavailable for this session</span>
              <button type="button" onClick={() => setNoticeDismissed(true)} className="text-amber-200 hover:text-white">
                Dismiss
              </button>
            </div>
          )}
        </div>

        {modelView === "compare" && (
          <div className="mt-8 grid gap-4">
            {filteredFlows.map((flow, index) => {
              const rf = displayModel(flow, "rf");
              const xgb = displayModel(flow, "xgb");
              const agreeText = flow.modelsAgree
                ? `âœ… Models Agree â†’ ${rf?.attackType || flow.attackFamily}`
                : `âš ï¸ Models Disagree: RF=${rf?.attackType || "Unknown"} | XGB=${xgb?.attackType || "Unavailable"}`;

              return (
                <div key={`compare-${flow.id}`} className="rounded-2xl border border-white/10 bg-[#0B1320]/80 p-5">
                  <div className="flex flex-col gap-2 border-b border-white/8 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-base font-semibold text-white">Flow #{String(index + 1).padStart(2, "0")}</h3>
                    <p className="text-sm text-slate-300">
                      {flow.sourceIp} â†’ {flow.destIp}
                    </p>
                  </div>

                  <div className={`grid gap-4 py-4 ${xgb ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                    {(["rf", "xgb"] as const).map((model) => {
                      const detail = displayModel(flow, model);
                      if (!detail) {
                        return null;
                      }

                      return (
                        <div key={model} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                          <p className="text-sm font-semibold text-cyan-200">{model === "rf" ? "ðŸŒ² Random Forest" : "âš¡ XGBoost"}</p>
                          <div className="mt-3 space-y-2 text-sm text-slate-200">
                            <p>
                              Binary: <span className="font-bold text-white">{detail.binary.toUpperCase()}</span> {detail.binaryConfidence}%
                            </p>
                            <p>
                              Type:{" "}
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  attackColorMap[detail.attackType] || "bg-slate-400 text-slate-950"
                                }`}
                              >
                                {detail.attackType}
                              </span>{" "}
                              {detail.attackConfidence}%
                            </p>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${
                                  attackBarMap[detail.attackType] || "from-cyan-400 to-cyan-200"
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, detail.binaryConfidence))}%` }}
                              />
                            </div>
                            {explainUrl(flow, model) && (
                              <button
                                type="button"
                                onClick={() => window.open(explainUrl(flow, model), "_blank", "noopener,noreferrer")}
                                className="mt-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:border-cyan-300/50"
                              >
                                Explain {model.toUpperCase()} â–¸
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {xgb && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                        flow.modelsAgree
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                          : "border-yellow-300/25 bg-yellow-300/10 text-yellow-100"
                      }`}
                    >
                      {agreeText}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* ── XGB DUAL MODEL END ── */}

        <div className={`${modelView === "compare" ? "mt-8" : "mt-8"} overflow-hidden rounded-[24px] border border-white/8 bg-[#0B1320]/80`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-white/8 bg-white/[0.03]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="inline-flex items-center gap-2 transition hover:text-cyan-300"
                      >
                        {column.label}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredFlows.map((flow) => (
                  <motion.tr
                    key={flow.id}
                    layout
                    onClick={() => onSelectFlow(flow)}
                    className={`cursor-pointer border-b border-white/6 transition ${predictionStyles[flow.prediction].row} ${
                      selectedFlowId === flow.id ? "bg-cyan-400/8" : ""
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${predictionStyles[flow.prediction].dot}`} />
                        <span className="text-sm font-semibold text-white">{flow.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-200">{flow.sourceIp}</td>
                    <td className="px-4 py-4 text-sm text-slate-200">{flow.destIp}</td>
                    <td className="px-4 py-4 text-sm text-slate-300">{flow.protocol}</td>
                    <td className="px-4 py-4 text-sm text-slate-300">{flow.packetCount}</td>
                    <td className="px-4 py-4 text-sm text-slate-300">{formatBytes(flow.bytes)}</td>
                    <td className="px-4 py-4 text-sm text-slate-300">{formatDuration(flow.duration)}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${predictionStyles[flow.prediction].badge}`}>
                          {flow.prediction}
                        </span>
                        {flow.prediction !== "Benign" && (
                          <>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                attackColorMap[normalizeAttackCategory(flow.attackFamily)] || "bg-slate-400 text-slate-950"
                              }`}
                            >
                              {normalizeAttackCategory(flow.attackFamily) || "Attack"}
                            </span>
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${
                                  attackBarMap[normalizeAttackCategory(flow.attackFamily)] || "from-slate-400 to-slate-200"
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, flow.confidence))}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredFlows.length === 0 && (
            <div className="px-6 py-14 text-center text-sm text-slate-400">
              No flows match the current search and filters.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
