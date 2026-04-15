import React, { useState } from 'react';

interface FeaturesTableProps {
  featureNames: string[];
  rawFeatures: number[][];
  isExpanded: boolean;
  onToggle: () => void;
}

export const FeaturesTable: React.FC<FeaturesTableProps> = ({ 
  featureNames, 
  rawFeatures, 
  isExpanded, 
  onToggle 
}) => {
  const hasData = rawFeatures && rawFeatures.length > 0;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div 
          className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Intermediate Extraction Results</h3>
              <p className="text-sm text-slate-400">Raw features extracted from PCAP before model processing</p>
            </div>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors">
            <svg 
              className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="overflow-x-auto border-t border-slate-800">
            {hasData ? (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-900/80 text-xs font-medium uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-6 py-3 border-b border-slate-800">Flow Index</th>
                    {featureNames.map((name, idx) => (
                      <th key={idx} className="px-6 py-3 border-b border-slate-800">{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/30">
                  {rawFeatures.slice(0, 10).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-3 font-mono text-indigo-400">#{rowIdx + 1}</td>
                      {row.map((val, valIdx) => (
                        <td key={valIdx} className="px-6 py-3 text-slate-300 font-mono">
                          {typeof val === 'number' ? 
                            (val % 1 === 0 ? val : val.toFixed(4)) : val}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rawFeatures.length > 10 && (
                    <tr>
                      <td colSpan={featureNames.length + 1} className="px-6 py-4 text-center text-slate-500 italic bg-slate-900/50">
                        Showing first 10 flows out of {rawFeatures.length}. View logs for full extraction data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center bg-slate-900/20">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 mb-4 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <h4 className="text-slate-300 font-medium text-lg">No extraction data yet</h4>
                <p className="text-slate-500 mt-1 max-w-xs mx-auto">Upload a PCAP file above to see the raw features extracted by the backend before they are sent to the AI models.</p>
              </div>
            )}
            {hasData && (
              <div className="bg-slate-900/60 px-6 py-3 border-t border-slate-800 flex items-center justify-between">
                <p className="text-xs text-slate-500 italic">
                  * For performance, only the first 100 rows are shown in this preview. 
                </p>
                <button 
                  onClick={() => {
                    const blob = new Blob([JSON.stringify({ headers: featureNames, data: rawFeatures }, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = "intermediate_features.json";
                    a.click();
                  }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Preview
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
