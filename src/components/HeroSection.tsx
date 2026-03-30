import { motion } from "framer-motion";
import { Activity, ArrowRight, Network, ShieldAlert, Sparkles } from "lucide-react";

interface HeroSectionProps {
  onUploadClick: () => void;
  onResultsClick: () => void;
}

const heroBadges = [
  "Explainable ML decisions",
  "Per-flow threat triage",
  "Fast analyst handoff"
];

export const HeroSection = ({ onUploadClick, onResultsClick }: HeroSectionProps) => (
  <section id="overview" className="relative overflow-hidden">
    <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-20 lg:pt-16">
      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 shadow-glow"
        >
          <Sparkles className="h-4 w-4" />
          Production-style cyber analytics frontend
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="mt-7 max-w-3xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl"
        >
          Smart NIDS Platform
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16 }}
          className="mt-5 max-w-2xl text-lg leading-8 text-slate-300"
        >
          Detect, Explain, Secure. Upload packet captures, inspect extracted flows, and translate model decisions
          into analyst-friendly explanations with a SaaS-grade experience.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="mt-8 flex flex-col gap-4 sm:flex-row"
        >
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-cyan-300"
          >
            Upload PCAP Files
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onResultsClick}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:bg-white/10"
          >
            Review Flow Results
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32 }}
          className="mt-8 flex flex-wrap gap-3"
        >
          {heroBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-white/8 bg-white/5 px-4 py-2 text-sm text-slate-300"
            >
              {badge}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.18 }}
        className="relative z-10"
      >
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-soft backdrop-blur-xl">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400">Live Threat Snapshot</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Flow analytics control center</h2>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
              <Activity className="h-5 w-5 text-cyan-300" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-rose-500/15 p-2">
                  <ShieldAlert className="h-5 w-5 text-rose-300" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Critical anomaly score</p>
                  <p className="text-3xl font-semibold text-white">98.4%</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-rose-100/80">
                DoS behavior detected on a north-south edge flow with elevated confidence.
              </p>
            </div>

            <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/15 p-2">
                  <Network className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Explainability coverage</p>
                  <p className="text-3xl font-semibold text-white">100%</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-cyan-100/80">
                Every listed flow includes analyst-readable SHAP drivers and recommendations.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/8 bg-[#0B1320]/80 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Threat burst map</p>
                <p className="mt-1 text-lg font-semibold text-white">Adaptive telemetry pulse</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Monitoring active
              </span>
            </div>

            <div className="mt-5 grid grid-cols-6 gap-3">
              {Array.from({ length: 18 }).map((_, index) => (
                <motion.div
                  key={index}
                  className="h-10 rounded-2xl border border-cyan-400/10 bg-cyan-400/5"
                  animate={{
                    opacity: [0.35, 0.95, 0.35],
                    scaleY: [0.85, 1.1, 0.85]
                  }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    delay: index * 0.08
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);
