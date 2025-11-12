import React from "react";
import HeatmapGrid from "./HeatmapGrid";
import TimeToTargetHistogram from "./TimeToTargetHistogram";
import SectorWinRateBar from "./SectorWinRateBar";
import { useBacktestInsights } from "../hooks/useBacktestInsights";

export default function Insights({ 
  batchId, 
  date,
  onClose 
}: { 
  batchId: string; 
  date: string;
  onClose?: () => void;
}) {
  const { heatmap, histogram, sectorWin, suggestions, rows } = useBacktestInsights(batchId, date);

  // Check if we have backtest data
  const hasBacktestData = rows.some(r => r.backtest);

  if (!hasBacktestData) {
    return (
      <div className="bg-slate-800/50 p-8 text-center">
        <div className="text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-base font-medium">No backtest data available</p>
          <p className="text-sm mt-1 opacity-70">Run the backtest first to see insights</p>
        </div>
      </div>
    );
  }

  const totalSignals = rows.length;
  const entryHits = rows.filter(r => r.backtest?.entryHit).length;
  const targetHits = rows.filter(r => r.backtest?.outcome === "target").length;
  const slHits = rows.filter(r => r.backtest?.outcome === "sl").length;
  const overallWinRate = entryHits > 0 ? ((targetHits / entryHits) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 bg-slate-800/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-4">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h2 className="text-xl font-semibold text-slate-100">Backtest Insights & Analytics</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-3 py-1 rounded text-sm transition-colors"
          >
            Hide ✕
          </button>
        )}
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-xs mb-1">Total Signals</div>
          <div className="text-2xl font-bold text-slate-100">{totalSignals}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-xs mb-1">Entry Hits</div>
          <div className="text-2xl font-bold text-emerald-400">{entryHits}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-xs mb-1">Targets Hit</div>
          <div className="text-2xl font-bold text-green-400">{targetHits}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-slate-400 text-xs mb-1">Overall Win Rate</div>
          <div className="text-2xl font-bold text-yellow-400">{overallWinRate}%</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-5">
          <HeatmapGrid data={heatmap} />
        </div>
        <div className="bg-slate-800 rounded-lg p-5">
          <TimeToTargetHistogram data={histogram} />
        </div>
      </div>

      {/* Sector Analysis */}
      <div className="bg-slate-800 rounded-lg p-5">
        <SectorWinRateBar data={sectorWin} />
      </div>

      {/* Auto-suggestions */}
      <div className="rounded-lg border-2 border-sky-700 bg-sky-900/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <div className="text-base font-semibold text-sky-300">AI Suggestions for Tomorrow</div>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="text-slate-400 min-w-[140px]">Preferred Score Bands:</div>
            <div className="font-medium text-slate-100">
              {suggestions.scoreBandsPreferred.length > 0 
                ? suggestions.scoreBandsPreferred.join(", ") 
                : "Insufficient data"}
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="text-slate-400 min-w-[140px]">Focus Sectors:</div>
            <div className="font-medium text-slate-100">
              {suggestions.sectorsPreferred.length > 0 
                ? suggestions.sectorsPreferred.join(", ") 
                : "Insufficient data"}
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="text-slate-400 min-w-[140px]">Timing Strategy:</div>
            <div className="font-medium text-slate-100">{suggestions.timeRecommendation}</div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-4">
          <div className="text-emerald-300 font-medium mb-2">✅ Winners</div>
          <div className="text-2xl font-bold text-emerald-400">{targetHits}</div>
          <div className="text-xs text-emerald-300/70 mt-1">
            {entryHits > 0 ? ((targetHits / entryHits) * 100).toFixed(1) : 0}% of entries
          </div>
        </div>
        
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="text-red-300 font-medium mb-2">❌ Losers</div>
          <div className="text-2xl font-bold text-red-400">{slHits}</div>
          <div className="text-xs text-red-300/70 mt-1">
            {entryHits > 0 ? ((slHits / entryHits) * 100).toFixed(1) : 0}% of entries
          </div>
        </div>
      </div>
    </div>
  );
}

