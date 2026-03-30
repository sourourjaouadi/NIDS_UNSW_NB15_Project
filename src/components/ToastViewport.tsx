import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useToast } from "../hooks/useToast";

const toneStyles = {
  info: {
    icon: Info,
    accent: "text-cyan-300",
    border: "border-cyan-400/20"
  },
  success: {
    icon: CheckCircle2,
    accent: "text-emerald-300",
    border: "border-emerald-400/20"
  },
  warning: {
    icon: TriangleAlert,
    accent: "text-amber-300",
    border: "border-amber-400/20"
  },
  danger: {
    icon: TriangleAlert,
    accent: "text-rose-300",
    border: "border-rose-400/20"
  }
} as const;

export const ToastViewport = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => {
          const tone = toneStyles[toast.tone];
          const Icon = tone.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              className={`pointer-events-auto rounded-[24px] border ${tone.border} bg-[#0B1320]/95 p-4 shadow-soft backdrop-blur-xl`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl border border-white/8 bg-white/5 p-2 ${tone.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{toast.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-500 transition hover:text-white"
                  aria-label="Dismiss toast"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
