import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
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
import { FlowRecord } from "../types/nids";

interface ChartsSectionProps {
  flows: FlowRecord[];
}

const tooltipFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit"
});

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
    { label: "Normal", value: flows.filter((flow) => flow.prediction === "Normal").length, fill: "#22C55E" },
    { label: "Attack", value: flows.filter((flow) => flow.prediction === "Attack").length, fill: "#F43F5E" }
  ];

  const attackTimeline = useMemo(() => {
    if (!flows.length) {
      return [{ label: "No data", normal: 0, attack: 0 }];
    }

    const grouped = new Map<string, { label: string; normal: number; attack: number; sortKey: number }>();

    [...flows]
      .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
      .forEach((flow) => {
        const time = new Date(flow.timestamp);
        const label = Number.isNaN(time.getTime()) ? "Unknown" : tooltipFormatter.format(time);
        const sortKey = Number.isNaN(time.getTime()) ? Number.MAX_SAFE_INTEGER : time.getTime();

        if (!grouped.has(label)) {
          grouped.set(label, { label, normal: 0, attack: 0, sortKey });
        }

        const entry = grouped.get(label);
        if (!entry) {
          return;
        }

        if (flow.prediction === "Normal") {
          entry.normal += 1;
        } else {
          entry.attack += 1;
        }
      });

    return Array.from(grouped.values())
      .sort((left, right) => left.sortKey - right.sortKey)
      .map(({ sortKey: _sortKey, ...entry }) => entry);
  }, [flows]);

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
                This view now reflects the timestamps returned by the backend so each upload updates the trend view with
                real classified flows.
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
                  <linearGradient id="attackFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="normalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: "12px" }} />
                <Area
                  type="monotone"
                  dataKey="attack"
                  name="Attack"
                  stroke="#F43F5E"
                  fill="url(#attackFill)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="normal"
                  name="Normal"
                  stroke="#22C55E"
                  fill="url(#normalFill)"
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
            Every upload refreshes this distribution with the latest backend predictions.
          </p>

          <div className="mt-8 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classDistribution}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
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
