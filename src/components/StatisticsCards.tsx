import { motion } from "framer-motion";
import { Activity, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { FlowRecord } from "../types/nids";
import { useCountUp } from "../hooks/useCountUp";

interface StatisticsCardsProps {
  flows: FlowRecord[];
}

const StatCard = ({
  label,
  value,
  helper,
  icon: Icon,
  accent
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Activity;
  accent: string;
}) => {
  const count = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-soft backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-4xl font-semibold text-white">{count}</p>
          <p className="mt-3 text-sm leading-6 text-slate-300">{helper}</p>
        </div>
        <div className={`rounded-3xl border border-white/8 p-3 ${accent}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
};

export const StatisticsCards = ({ flows }: StatisticsCardsProps) => {
  const malicious = flows.filter((flow) => flow.prediction === "Malicious").length;
  const suspicious = flows.filter((flow) => flow.prediction === "Suspicious").length;
  const benign = flows.filter((flow) => flow.prediction === "Benign").length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total flows"
          value={flows.length}
          helper="Extracted sessions available for analyst triage."
          icon={Activity}
          accent="bg-cyan-400/15"
        />
        <StatCard
          label="Malicious flows"
          value={malicious}
          helper="High-priority flows requiring immediate investigation."
          icon={ShieldAlert}
          accent="bg-rose-500/15"
        />
        <StatCard
          label="Suspicious flows"
          value={suspicious}
          helper="Borderline sessions worth additional analyst review."
          icon={TriangleAlert}
          accent="bg-amber-500/15"
        />
        <StatCard
          label="Benign flows"
          value={benign}
          helper="Traffic aligned with the learned network baseline."
          icon={ShieldCheck}
          accent="bg-emerald-500/15"
        />
      </div>
    </section>
  );
};
