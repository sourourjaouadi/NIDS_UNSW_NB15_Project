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

const isAttackFlow = (flow: FlowRecord) => flow.prediction !== "Benign";

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
  /* ── XGB DUAL MODEL START ── */
  const compareBarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareRfDonutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareXgbDonutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareScatterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /* ── XGB DUAL MODEL END ── */

  const donutChartRef = useRef<ChartRef>(null);
  const top10ChartRef = useRef<ChartRef>(null);
  const stackedChartRef = useRef<ChartRef>(null);
  const radarChartRef = useRef<ChartRef>(null);
  const lineChartRef = useRef<ChartRef>(null);
  /* ── XGB DUAL MODEL START ── */
  const compareBarChartRef = useRef<ChartRef>(null);
  const compareRfDonutChartRef = useRef<ChartRef>(null);
  const compareXgbDonutChartRef = useRef<ChartRef>(null);
  const compareScatterChartRef = useRef<ChartRef>(null);
  const [showAllDisagreements, setShowAllDisagreements] = useState(false);
  /* ── XGB DUAL MODEL END ── */

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

  /* ── XGB DUAL MODEL START ── */
  const comparableFlows = useMemo(() => flows.filter((flow) => flow.xgb && flow.rf), [flows]);
  const disagreementFlows = useMemo(() => comparableFlows.filter((flow) => !flow.modelsAgree), [comparableFlows]);
  const hasXgbResults = comparableFlows.length > 0;
  const modelCategoryCounts = useMemo(() => {
    const rf = new Map<string, number>();
    const xgb = new Map<string, number>();
    comparableFlows.forEach((flow) => {
      const rfCat = normalizeAttackCategory(flow.rf?.multiclass_prediction || "Normal");
      const xgbCat = normalizeAttackCategory(flow.xgb?.multiclass_prediction || "Normal");
      rf.set(rfCat, (rf.get(rfCat) || 0) + 1);
      xgb.set(xgbCat, (xgb.get(xgbCat) || 0) + 1);
    });
    return { rf, xgb };
  }, [comparableFlows]);
  /* ── XGB DUAL MODEL END ── */

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
      compareBarChartRef.current?.destroy();
      compareRfDonutChartRef.current?.destroy();
      compareXgbDonutChartRef.current?.destroy();
      compareScatterChartRef.current?.destroy();
      donutChartRef.current = null;
      top10ChartRef.current = null;
      stackedChartRef.current = null;
      radarChartRef.current = null;
      lineChartRef.current = null;
      compareBarChartRef.current = null;
      compareRfDonutChartRef.current = null;
      compareXgbDonutChartRef.current = null;
      compareScatterChartRef.current = null;
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
      const normalCount = flows.filter((f) => f.prediction === "Benign").length;
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

    /* ── XGB DUAL MODEL START ── */
    if (hasXgbResults && compareBarCanvasRef.current) {
      const sessionLabels = Array.from(new Set(comparableFlows.map((flow) => flow.sessionSource || flow.sessionId || "Session")));
      compareBarChartRef.current = new Chart(compareBarCanvasRef.current, {
        type: "bar",
        data: {
          labels: sessionLabels,
          datasets: [
            {
              label: "RF attacks",
              data: sessionLabels.map((session) =>
                comparableFlows.filter((flow) => (flow.sessionSource || flow.sessionId || "Session") === session && flow.rf?.binary_prediction === "Attack").length
              ),
              backgroundColor: "#22D3EE"
            },
            {
              label: "XGB attacks",
              data: sessionLabels.map((session) =>
                comparableFlows.filter((flow) => (flow.sessionSource || flow.sessionId || "Session") === session && flow.xgb?.binary_prediction === "Attack").length
              ),
              backgroundColor: "#FF9100"
            }
          ]
        },
        options: {
          scales: {
            x: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.08)" } },
            y: { ticks: { color: "#94A3B8" }, grid: { color: "rgba(148,163,184,0.15)" } }
          },
          plugins: { legend: { labels: { color: "#CBD5E1" } } }
        }
      });
    }

    const makeDonut = (canvas: HTMLCanvasElement | null, counts: Map<string, number>) => {
      if (!canvas) return null;
      const labels = Array.from(counts.keys()).filter((label) => (counts.get(label) || 0) > 0);
      return new Chart(canvas, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: labels.map((label) => counts.get(label) || 0),
              backgroundColor: labels.map((label) => attackColorMap[label] || "#94A3B8"),
              borderColor: "#0B1320",
              borderWidth: 2
            }
          ]
        },
        options: { plugins: { legend: { labels: { color: "#CBD5E1" } } } }
      });
    };

    if (hasXgbResults) {
      compareRfDonutChartRef.current = makeDonut(compareRfDonutCanvasRef.current, modelCategoryCounts.rf);
      compareXgbDonutChartRef.current = makeDonut(compareXgbDonutCanvasRef.current, modelCategoryCounts.xgb);
    }

    if (hasXgbResults && compareScatterCanvasRef.current) {
      const diagonalPlugin = {
        id: "compare-diagonal",
        afterDatasetsDraw(chart: any) {
          const { ctx, chartArea, scales } = chart;
          ctx.save();
          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = "rgba(226,232,240,0.55)";
          ctx.beginPath();
          ctx.moveTo(scales.x.getPixelForValue(0), scales.y.getPixelForValue(0));
          ctx.lineTo(scales.x.getPixelForValue(1), scales.y.getPixelForValue(1));
          ctx.stroke();
          ctx.restore();
        }
      };

      compareScatterChartRef.current = new Chart(compareScatterCanvasRef.current, {
        type: "scatter",
        data: {
          datasets: [
            {
              label: "Flow confidence",
              data: comparableFlows.map((flow) => ({
                x: flow.rf?.binary_confidence ?? 0,
                y: flow.xgb?.binary_confidence ?? 0
              })),
              pointBackgroundColor: comparableFlows.map((flow) => {
                if (!flow.modelsAgree) return "#FFEA00";
                return flow.rf?.binary_prediction === "Attack" ? "#FF1744" : "#22C55E";
              }),
              pointRadius: 4
            }
          ]
        },
        options: {
          scales: {
            x: { min: 0, max: 1, title: { display: true, text: "RF confidence", color: "#CBD5E1" }, ticks: { color: "#94A3B8" } },
            y: { min: 0, max: 1, title: { display: true, text: "XGB confidence", color: "#CBD5E1" }, ticks: { color: "#94A3B8" } }
          },
          plugins: { legend: { labels: { color: "#CBD5E1" } } }
        },
        plugins: [diagonalPlugin]
      });
    }
    /* ── XGB DUAL MODEL END ── */

    return destroyAll;
  }, [expanded, flows, attacks, attackCounts, comparableFlows, hasXgbResults, modelCategoryCounts]);

  return (
    <section id="analytics-panel" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200"
        >
          Show Analytics {expanded ? "â–´" : "â–¾"}
        </button>

        {expanded && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
              <h3 className="text-sm font-semibold text-white">Attack Category Breakdown</h3>
              {attacks.length > 0 ? <canvas ref={donutCanvasRef} /> : <p className="mt-3 text-sm text-slate-400">No data available</p>}
            </div>

            <div className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
              <h3 className="text-sm font-semibold text-white">Top 10 Most Suspicious Flows</h3>
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

            {/* ── XGB DUAL MODEL START ── */}
            {hasXgbResults && (
              <div className="rounded-2xl border border-cyan-400/15 bg-[#0B1320]/80 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-white">Model Comparison</h3>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-2">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      RF vs XGB Detection Count per Session
                    </h4>
                    <canvas id="compare-detection-count" ref={compareBarCanvasRef} />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">RF Attack Category Distribution</h4>
                    <canvas id="compare-rf-donut" ref={compareRfDonutCanvasRef} />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-200">XGB Attack Category Distribution</h4>
                    <canvas id="compare-xgb-donut" ref={compareXgbDonutCanvasRef} />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-2">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Confidence Correlation RF vs XGB</h4>
                    <canvas id="compare-confidence-scatter" ref={compareScatterCanvasRef} />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 lg:col-span-2">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-200">Model Disagreements</h4>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
                          <tr>
                            <th className="px-3 py-2">Session</th>
                            <th className="px-3 py-2">Flow#</th>
                            <th className="px-3 py-2">Srcâ†’Dst</th>
                            <th className="px-3 py-2">RF Pred</th>
                            <th className="px-3 py-2">RF Conf%</th>
                            <th className="px-3 py-2">XGB Pred</th>
                            <th className="px-3 py-2">XGB Conf%</th>
                            <th className="px-3 py-2">Explain</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(showAllDisagreements ? disagreementFlows : disagreementFlows.slice(0, 50)).map((flow) => (
                            <tr key={`disagree-${flow.id}`} className="border-t border-white/8 text-slate-200">
                              <td className="px-3 py-2">{flow.sessionSource || flow.sessionId || "Session"}</td>
                              <td className="px-3 py-2">{flow.flowIndex ?? 0}</td>
                              <td className="px-3 py-2">{flow.sourceIp}â†’{flow.destIp}</td>
                              <td className="px-3 py-2">{flow.rf?.multiclass_prediction || flow.rf?.binary_prediction}</td>
                              <td className="px-3 py-2">{Math.round((flow.rf?.binary_confidence ?? 0) * 100)}</td>
                              <td className="px-3 py-2">{flow.xgb?.multiclass_prediction || flow.xgb?.binary_prediction}</td>
                              <td className="px-3 py-2">{Math.round((flow.xgb?.binary_confidence ?? 0) * 100)}</td>
                              <td className="px-3 py-2">
                                {flow.sessionId && flow.flowIndex !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => window.open(`/api/explain/${flow.sessionId}/${flow.flowIndex}?model=xgb`, "_blank", "noopener,noreferrer")}
                                    className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                  >
                                    Explain
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {disagreementFlows.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No model disagreements found.</p>}
                    </div>
                    {disagreementFlows.length > 50 && (
                      <button
                        type="button"
                        onClick={() => setShowAllDisagreements((value) => !value)}
                        className="mt-4 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-4 py-2 text-sm font-semibold text-yellow-100"
                      >
                        {showAllDisagreements ? "Show first 50" : "Show more"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* ── XGB DUAL MODEL END ── */}
          </div>
        )}
      </div>
    </section>
  );
};
