import { Database, RotateCcw, ShieldAlert, ShieldCheck, Sigma } from "lucide-react";
import { FlowRecord } from "../types/nids";

interface SessionSummary {
  id: string;
  source: string;
  flowCount: number;
  uploadedAt: string;
}

interface CumulativeDashboardProps {
  flows: FlowRecord[];
  sessions: SessionSummary[];
  onClearHistory: () => void;
}

const Stat = ({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string | number;
  icon: typeof Sigma;
}) => (
  <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
    <div className="flex items-center justify-between">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <Icon className="h-4 w-4 text-cyan-300" />
    </div>
    <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
  </div>
);

export const CumulativeDashboard = ({ flows, sessions, onClearHistory }: CumulativeDashboardProps) => {
  const attackFlows = flows.filter((f) => f.prediction !== "Benign").length;
  const benignFlows = flows.filter((f) => f.prediction === "Benign").length;
  const topAttack = flows
    .filter((f) => f.prediction !== "Benign")
    .reduce<Record<string, number>>((acc, flow) => {
      acc[flow.attackFamily] = (acc[flow.attackFamily] || 0) + 1;
      return acc;
    }, {});
  const topAttackLabel =
    Object.entries(topAttack).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Cumulative Dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">All sessions combined</h2>
            <p className="mt-2 text-sm text-slate-300">
              Every uploaded PCAP/CSV appends to this shared history until you clear it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15"
          >
            <RotateCcw className="h-4 w-4" />
            Clear History
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Sessions" value={sessions.length} icon={Database} />
          <Stat label="Total Flows" value={flows.length} icon={Sigma} />
          <Stat label="Attack Flows" value={attackFlows} icon={ShieldAlert} />
          <Stat label="Benign Flows" value={benignFlows} icon={ShieldCheck} />
          <Stat label="Top Attack" value={topAttackLabel} icon={ShieldAlert} />
        </div>
      </div>
    </section>
  );
};
