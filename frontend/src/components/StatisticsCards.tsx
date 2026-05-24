import { motion } from "framer-motion";
import { Activity, ShieldAlert, ShieldCheck } from "lucide-react";
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
  const attacks = flows.filter((flow) => flow.prediction === "Attack").length;
  const normal = flows.filter((flow) => flow.prediction === "Normal").length;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total flows"
          value={flows.length}
          helper="Extracted sessions available for analyst triage."
          icon={Activity}
          accent="bg-cyan-400/15"
        />
        <StatCard
          label="Attack flows"
          value={attacks}
          helper="Flows classified as intrusions and passed to attack-family detection."
          icon={ShieldAlert}
          accent="bg-rose-500/15"
        />
        <StatCard
          label="Normal flows"
          value={normal}
          helper="Traffic aligned with the learned network baseline."
          icon={ShieldCheck}
          accent="bg-emerald-500/15"
        />
      </div>
    </section>
  );
};
