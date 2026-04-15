import React from 'react';
import { FlowRecord } from '../types/nids';

interface FeatureGroup {
  title: string;
  features: string[];
}

const groups: FeatureGroup[] = [
  {
    title: "Network Identification",
    features: ['sport', 'dsport', 'proto', 'service', 'state']
  },
  {
    title: "Traffic & Volume",
    features: ['dur', 'sbytes', 'dbytes', 'sttl', 'dttl', 'spkts', 'dpkts', 'sload', 'dload']
  },
  {
    title: "TCP Dynamics",
    features: ['dwin', 'stcpb', 'dtcpb', 'tcprtt', 'synack', 'ackdat']
  },
  {
    title: "Timing & Jitter",
    features: ['sjit', 'djit', 'sintpkt', 'dintpkt']
  },
  {
    title: "Context & Behavior",
    features: ['is_sm_ips_ports', 'ct_state_ttl', 'ct_flw_http_mthd', 'is_ftp_login', 'ct_ftp_cmd', 'ct_srv_src', 'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm']
  }
];

interface ExtractionBreakdownProps {
  flow: FlowRecord | null;
}

export const ExtractionBreakdown: React.FC<ExtractionBreakdownProps> = ({ flow }) => {
  if (!flow || !flow.rawFeatures || !flow.scaledFeatures) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </div>
        <h4 className="text-lg font-medium text-slate-300">No Flow Selected</h4>
        <p className="mt-2 max-w-xs text-sm text-slate-500">
          Select a flow from the table above to visualize exactly how it was treated and transformed into features.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl">
      <div className="mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="h-6 w-1 bg-indigo-500 rounded-full"></span>
            Feature Extraction Breakdown
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Raw observations vs. Scaled values fed to the ML model
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
            Ready for Model
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {groups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              {group.title}
            </h4>
            <div className="grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800">
              {group.features.map((key) => {
                const raw = flow.rawFeatures?.[key];
                const scaled = flow.scaledFeatures?.[key];
                
                if (raw === undefined) return null;

                return (
                  <div key={key} className="grid grid-cols-12 gap-3 bg-slate-900/80 px-4 py-3 hover:bg-slate-800/40 transition-colors group">
                    <div className="col-span-4 flex flex-col justify-center">
                      <span className="text-xs font-mono font-medium text-slate-300 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{key}</span>
                    </div>
                    
                    <div className="col-span-4 border-l border-slate-800 pl-3">
                      <div className="text-[10px] uppercase font-bold text-slate-600 mb-0.5">Raw</div>
                      <div className="text-sm font-mono text-slate-200">
                        {typeof raw === 'number' ? (raw % 1 === 0 ? raw : raw.toFixed(3)) : raw}
                      </div>
                    </div>

                    <div className="col-span-4 border-l border-slate-800 pl-3">
                      <div className="text-[10px] uppercase font-bold text-indigo-500/70 mb-0.5">Scaled</div>
                      <div className="text-sm font-mono text-indigo-400 font-semibold">
                        {typeof scaled === 'number' ? scaled.toFixed(4) : scaled}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-indigo-500/5 p-4 border border-indigo-500/20">
        <div className="flex gap-3">
          <div className="mt-0.5 text-indigo-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-indigo-400">Scale Interpretation:</strong> Values close to <span className="text-indigo-300 font-mono">0.0</span> represent common or baseline activity, while values closer to <span className="text-indigo-300 font-mono">1.0</span> (or larger in some models) represent extreme outlier behavior relative to the training set.
          </p>
        </div>
      </div>
    </div>
  );
};
