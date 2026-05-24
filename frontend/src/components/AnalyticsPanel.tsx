import { useEffect, useMemo, useRef, useState } from "react";
import { FlowRecord } from "../types/nids";

type AttackColorMap = Record<string, string>;

const attackColorMap: AttackColorMap = {
  Fuzzers: "#00E5FF",
  DoS: "#FF1744",
  Exploits: "#FF9100",
  Reconnaissance: "#FFEA00",
  Generic: "#B388FF",
  Backdoors: "#FF00FF",
  Shellcode: "#FF6D00",
  Worms: "#AEEA00",
  Analysis: "#1DE9B6",
  Normal: "#22C55E"
};

const attackOrder = [
  "Fuzzers",
  "Analysis",
  "Backdoors",
  "DoS",
  "Exploits",
  "Generic",
  "Reconnaissance",
  "Shellcode",
  "Worms"
];

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
  if (v === "worms" || v === "worms") return "Worms";
  if (v === "normal") return "Normal";
  return value || "Unknown";
};

const isAttackFlow = (flow: FlowRecord) => flow.prediction === "Attack";

type ChartRef = { destroy: () => void } | null;

declare global {
  interface Window {
    Chart?: any;
  }
}

interface AnalyticsPanelProps {
  flows: FlowRecord[];
}

export const AnalyticsPanel = ({ flows }: AnalyticsPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const donutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const top10CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stackedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const donutChartRef = useRef<ChartRef>(null);
  const top10ChartRef = useRef<ChartRef>(null);
  const stackedChartRef = useRef<ChartRef>(null);
  const radarChartRef = useRef<ChartRef>(null);
  const lineChartRef = useRef<ChartRef>(null);

  const attacks = useMemo(() => {
    return flows
      .filter(isAttackFlow)
      .map((flow) => ({ ...flow, attackType: normalizeAttackCategory(flow.attackFamily || "Unknown") }));
  }, [flows]);

  const attackCounts = useMemo(() => {
    const counts = new Map<string, number>();
    attacks.forEach((flow) => counts.set(flow.attackType, (counts.get(flow.attackType) || 0) + 1));
    return counts;
  }, [attacks]);

  useEffect(() => {
    if (!expanded || !window.Chart) {
      return;
    }

    const Chart = window.Chart;

    const destroyAll = () => {
      donutChartRef.current?.destroy();
      top10ChartRef.current?.destroy();
      stackedChartRef.current?.destroy();
      radarChartRef.current?.destroy();
      lineChartRef.current?.destroy();
      donutChartRef.current = null;
      top10ChartRef.current = null;
      stackedChartRef.current = null;
      radarChartRef.current = null;
      lineChartRef.current = null;
    };

    destroyAll();

    const attackLabels = Array.from(attackCounts.keys());
    const attackValues = attackLabels.map((label) => attackCounts.get(label) || 0);

    if (donutCanvasRef.current && attackLabels.length > 0) {
      donutChartRef.current = new Chart(donutCanvasRef.current, {
        type: "doughnut",
        data: {
          labels: attackLabels,
          datasets: [
            {
              data: attackValues,
              backgroundColor: attackLabels.map((label) => attackColorMap[label] || "#94A3B8"),
              borderColor: "#0B1320",
              borderWidth: 2
            }
          ]
        },
        options: {
          plugins: {
            legend: { labels: { color: "#CBD5E1" } },
            tooltip: { enabled: true }
          }
        },
        plugins: [
          {
            id: "centerText",
            afterDraw(chart: any) {
              const { ctx } = chart;
              ctx.save();
              ctx.font = "600 18px Inter";
              ctx.fillStyle = "#E2E8F0";
              ctx.textAlign = "center";
              ctx.fillText(`${attacks.length}`, chart.width / 2, chart.height / 2 + 6);
              ctx.restore();
            }
          }
        ]
      });
    }

    const top10 = [...attacks]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    if (top10CanvasRef.current && top10.length > 0) {
      top10ChartRef.current = new Chart(top10CanvasRef.current, {
        type: "bar",
        data: {
          labels: top10.map((f) => `${f.sourceIp}:${f.id.slice(0, 8)}`),
          datasets: [
            {
              label: "Multiclass Confidence",
              data: top10.map((f) => Number((f.confidence / 100).toFixed(3))),
              backgroundColor: top10.map((f) => attackColorMap[f.attackType] || "#94A3B8")
            }
          ]
        },
        options: {
          indexAxis: "y",
          scales: {
            x: { min: 0, max: 1, ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.15)" } },
            y: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.08)" } }
          },
          plugins: { legend: { labels: { color: "#CBD5E1" } } }
        }
      });
    }

    if (stackedCanvasRef.current && flows.length > 0) {
      const normalCount = flows.filter((f) => f.prediction === "Normal").length;
      const stackedLabels = ["Session"];
      const datasets = [
        {
          label: "Normal",
          data: [normalCount],
          backgroundColor: attackColorMap.Normal
        },
        ...attackOrder.map((cat) => ({
          label: cat,
          data: [attackCounts.get(cat) || 0],
          backgroundColor: attackColorMap[cat]
        }))
      ];

      stackedChartRef.current = new Chart(stackedCanvasRef.current, {
        type: "bar",
        data: { labels: stackedLabels, datasets },
        options: {
          scales: {
            x: { stacked: true, ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.08)" } },
            y: { stacked: true, ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.15)" } }
          },
          plugins: { legend: { labels: { color: "#CBD5E1" } } }
        }
      });
    }

    if (radarCanvasRef.current) {
      const radarValues = attackOrder.map((cat) => attackCounts.get(cat) || 0);
      const hasRadarData = radarValues.some((v) => v > 0);
      if (hasRadarData) {
        radarChartRef.current = new Chart(radarCanvasRef.current, {
          type: "radar",
          data: {
            labels: attackOrder,
            datasets: [
              {
                label: "Attack Profile",
                data: radarValues,
                borderColor: "#39FF14",
                backgroundColor: "rgba(57,255,20,0.18)",
                pointBackgroundColor: "#39FF14"
              }
            ]
          },
          options: {
            scales: {
              r: {
                angleLines: { color: "rgba(148,163,184,0.15)" },
                grid: { color: "rgba(148,163,184,0.15)" },
                pointLabels: { color: "#CBD5E1" },
                ticks: { color: "#94A3B8", backdropColor: "transparent" }
              }
            },
            plugins: { legend: { labels: { color: "#CBD5E1" } } }
          }
        });
      }
    }

    if (lineCanvasRef.current && flows.length > 0) {
      lineChartRef.current = new Chart(lineCanvasRef.current, {
        type: "line",
        data: {
          labels: flows.map((_, i) => `#${i + 1}`),
          datasets: [
            {
              label: "Binary Confidence",
              data: flows.map((f) => Number((f.confidence / 100).toFixed(3))),
              borderColor: "#22D3EE",
              backgroundColor: "rgba(34,211,238,0.2)",
              tension: 0.3,
              pointBackgroundColor: flows.map((f) => (isAttackFlow(f) ? "#FF1744" : "#22C55E")),
              pointRadius: 3
            },
            {
              label: "Threshold 0.5",
              data: flows.map(() => 0.5),
              borderColor: "#FFEA00",
              borderDash: [6, 6],
              pointRadius: 0
            }
          ]
        },
        options: {
          scales: {
            x: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.08)" } },
            y: { min: 0, max: 1, ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.15)" } }
          },
          plugins: { legend: { labels: { color: "#CBD5E1" } } }
        }
      });
    }

    return destroyAll;
  }, [expanded, flows, attacks, attackCounts]);

  return (
    <section id="analytics-panel" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200"
        >
          Show Analytics {expanded ? "▴" : "▾"}
        </button>

        {expanded && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
              <h3 className="text-sm font-semibold text-white">Attack Category Breakdown</h3>
              {attacks.length > 0 ? <canvas ref={donutCanvasRef} /> : <p className="mt-3 text-sm text-slate-400">No data available</p>}
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
              <h3 className="text-sm font-semibold text-white">Top 10 Attack Flows</h3>
              {attacks.length > 0 ? <canvas ref={top10CanvasRef} /> : <p className="mt-3 text-sm text-slate-400">No data available</p>}
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
              <h3 className="text-sm font-semibold text-white">Traffic Classification Overview</h3>
              {flows.length > 0 ? <canvas ref={stackedCanvasRef} /> : <p className="mt-3 text-sm text-slate-400">No data available</p>}
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
              <h3 className="text-sm font-semibold text-white">Attack Profile</h3>
              {attacks.length > 0 ? <canvas ref={radarCanvasRef} /> : <p className="mt-3 text-sm text-slate-400">No data available</p>}
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-white">Flow Analysis Over Time</h3>
              {flows.length > 0 ? <canvas ref={lineCanvasRef} /> : <p className="mt-3 text-sm text-slate-400">No data available</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
