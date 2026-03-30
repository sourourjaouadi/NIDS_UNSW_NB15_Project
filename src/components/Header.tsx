import { AnimatePresence, motion } from "framer-motion";
import { Menu, Shield, X } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onUploadClick: () => void;
}

const links = [
  { label: "Overview", href: "#overview" },
  { label: "Upload", href: "#upload" },
  { label: "Insights", href: "#insights" },
  { label: "Flows", href: "#flows" }
];

export const Header = ({ onUploadClick }: HeaderProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[#0D1117]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="#overview" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 shadow-glow">
            <Shield className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-white">Smart NIDS Platform</p>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Detect, Explain, Secure</p>
          </div>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-300 transition hover:text-cyan-300"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live telemetry simulated
          </div>
          <button
            type="button"
            onClick={onUploadClick}
            className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:scale-[1.02] hover:bg-cyan-300"
          >
            Upload PCAP Files
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="border-t border-white/6 bg-[#0D1117]/95 px-4 py-4 lg:hidden"
          >
            <div className="flex flex-col gap-3">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl border border-white/6 bg-white/5 px-4 py-3 text-sm text-slate-200"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onUploadClick();
                }}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950"
              >
                Upload PCAP Files
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
