import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { attackTimeline } from "../data/mockData";
import { FlowRecord } from "../types/nids";

interface ChartsSectionProps {
  flows: FlowRecord[];
}

const ChartTooltip = ({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name: string; value: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1320]/95 p-3 shadow-soft">
      <p className="text-sm font-semibold text-white">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}: {item.value}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartsSection = ({ flows }: ChartsSectionProps) => {
  const classDistribution = [
    { label: "Benign", value: flows.filter((flow) => flow.prediction === "Benign").length, fill: "#22C55E" },
    { label: "Suspicious", value: flows.filter((flow) => flow.prediction === "Suspicious").length, fill: "#F59E0B" },
    { label: "Malicious", value: flows.filter((flow) => flow.prediction === "Malicious").length, fill: "#F43F5E" }
  ];

  return (
    <section id="insights" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Attack Distribution</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Threat activity over time</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Trend visibility helps analysts spot bursts, quiet periods, and shifts from reconnaissance into direct
                exploitation.
              </p>
            </div>
            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-3">
              <BarChart3 className="h-5 w-5 text-cyan-300" />
            </div>
          </div>

          <div className="mt-8 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attackTimeline}>
                <defs>
                  <linearGradient id="maliciousFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="suspiciousFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: "12px" }} />
                <Area
                  type="monotone"
                  dataKey="malicious"
                  name="Malicious"
                  stroke="#F43F5E"
                  fill="url(#maliciousFill)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="suspicious"
                  name="Suspicious"
                  stroke="#F59E0B"
                  fill="url(#suspiciousFill)"
                  strokeWidth={2.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl"
        >
          <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Class Mix</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Prediction breakdown</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            A compact distribution view helps explain the ratio of noisy flows versus verified threats.
          </p>

          <div className="mt-8 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {classDistribution.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
