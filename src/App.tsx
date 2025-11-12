
import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { db } from "./db";
import { STRATEGIES, StrategyName, Row } from "./strategies";
import { toNum } from "./utils";
import Settings from "./components/Settings";
import Insights from "./components/Insights";
import { backtestBatch } from "./backtest";

type Raw = Record<string, string>;

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [strategy, setStrategy] = useState<StrategyName>("Momentum (Gap-Up Near High)");
  const [signals, setSignals] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"generate"|"history">("generate");
  const [savedSignals, setSavedSignals] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backtestingBatchId, setBacktestingBatchId] = useState<string | null>(null);
  const [expandedInsightsBatchId, setExpandedInsightsBatchId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date().toISOString().slice(0,10), []);

  const loadHistory = async () => {
    const all = await db.signals.orderBy("date").reverse().toArray();
    // Group by date + strategy + CSV filename (so each upload is separate)
    const grouped = all.reduce((acc: any, signal: any) => {
      const csvFile = signal.details?.csvFileName || "Unknown.csv";
      const key = `${signal.date}_${signal.strategy}_${csvFile}`;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          date: signal.date,
          strategy: signal.strategy,
          csvFileName: csvFile,
          signals: [],
          isExpanded: false,
        };
      }
      acc[key].signals.push(signal);
      return acc;
    }, {});
    const batches = Object.values(grouped);
    setSavedSignals(batches);
    // Set first tab as expanded by default
    if (batches.length > 0) {
      batches[0].isExpanded = true;
    }
  };

  const toggleBatch = (batchId: string) => {
    setSavedSignals(prev => 
      prev.map(batch => 
        batch.id === batchId 
          ? { ...batch, isExpanded: !batch.isExpanded }
          : batch
      )
    );
  };

  const deleteBatch = async (batchId: string) => {
    // Split by underscore: date_strategy_csvfilename
    const parts = batchId.split('_');
    const date = parts[0];
    const csvFileName = parts[parts.length - 1]; // Last part is CSV filename
    
    const toDelete = await db.signals
      .where('date').equals(date)
      .and(s => s.details?.csvFileName === csvFileName)
      .toArray();
    
    const ids = toDelete.map(s => s.id).filter(Boolean) as string[];
    await db.signals.bulkDelete(ids);
    
    loadHistory(); // Refresh
    alert(`✅ Deleted ${ids.length} signals from ${csvFileName}`);
  };

  const runBacktest = async (batch: any) => {
    // Check if backtest already exists
    const hasBacktest = batch.signals.some((s: any) => s.backtest);
    if (hasBacktest) {
      const rerun = confirm(
        `Backtest data already exists for this batch.\n\nNote: Results are deterministic and won't change.\n\nDo you want to re-run anyway?`
      );
      if (!rerun) return;
    }

    setBacktestingBatchId(batch.id);
    try {
      const results = await backtestBatch(batch.signals);
      await loadHistory(); // Reload to get updated data
      
      // Check how many used real data
      const realDataCount = results.filter(r => r.backtest?.usedRealData).length;
      const totalCount = results.length;
      
      let message = `✅ Backtest completed for ${totalCount} signals!\n\n`;
      
      if (realDataCount === totalCount) {
        message += `✅ Using REAL historical data from Dhan API\nResults are based on actual market data.`;
      } else if (realDataCount > 0) {
        message += `📊 Mixed data sources:\n• Real data: ${realDataCount} stocks\n• Mock data: ${totalCount - realDataCount} stocks (API fetch failed)\n\nCheck console for details.`;
      } else {
        message += `⚠️ Using MOCK/SIMULATED data\nDhan API may not be configured or data fetch failed.\n\nConfigure Dhan API credentials in Settings for real data.`;
      }
      
      alert(message);
    } catch (error) {
      console.error('Backtest error:', error);
      alert('❌ Backtest failed. Check console for details.');
    } finally {
      setBacktestingBatchId(null);
    }
  };

  const downloadCSV = (batch: any) => {
    const headers = ['Symbol', 'Side', 'Entry', 'Target', 'Stop Loss', 'R:R', 'Score', 'Why'];
    const rows = batch.signals.map((s: any) => [
      s.symbol,
      s.side,
      s.entry?.toFixed(2) ?? '',
      s.target?.toFixed(2) ?? '',
      s.stopLoss?.toFixed(2) ?? '',
      s.riskReward ?? '',
      s.score?.toFixed(2) ?? '',
      s.details?.why ?? ''
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map((r: any[]) => r.map((cell: any) => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signals_${batch.date}_${batch.strategy.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (file: File) => {
    setCsvFileName(file.name); // Store filename
    Papa.parse<Raw>(file, {
      header: true,
      complete: (res) => {
        // Show what columns are in the CSV
        if (res.data.length > 0) {
          const firstRow = res.data[0] as Raw;
          const columnNames = Object.keys(firstRow);
          console.log("📋 CSV Column Names Found:", columnNames);
          console.log("📄 First row data:", firstRow);
        }
        
        const map = (r: Raw): Row => {
          // Helper to find column with flexible matching (handles newlines, spaces, case)
          const getCol = (keys: string[]) => {
            for (const key of keys) {
              const found = Object.keys(r).find(k => 
                k.trim().toLowerCase().replace(/\s+/g, ' ') === key.toLowerCase()
              );
              if (found && r[found]) return r[found];
            }
            return "";
          };
          
          return {
            symbol: getCol(["symbol", "symbol \\n"]),
            prev_close: toNum(getCol(["prev._close", "prev. close", "prev. close \\n"])),
            iep: toNum(getCol(["iep", "iep \\n"])),
            pct_chg: toNum(getCol(["pctchng", "%chng", "%chng \\n"])),
            nm_52w_h: toNum(getCol(["nm_52w_h", "52w high", "nm 52w h", "nm 52w h \\n"])),
            nm_52w_l: toNum(getCol(["nm_52w_l", "52w low", "nm 52w l", "nm 52w l \\n"])),
            value_cr: toNum(getCol(["value_\\n_(₹_crores)", "value (cr)", "value \\n (₹ crores)", "value"])),
            final_qty: toNum(getCol(["final_quantity", "final qty", "final quantity \\n"])),
          };
        };
        const cleaned = res.data.map(map).filter(r => r.symbol);
        console.log(`✅ Loaded ${cleaned.length} rows from CSV`);
        console.log("Sample mapped row:", cleaned[0]);
        setRows(cleaned);
        setSignals([]); // Clear previous signals when new data is loaded
        
        if (cleaned.length === 0) {
          alert("⚠️ CSV loaded but no valid rows found. Check column names!\n\nOpen the console (F12) to see what columns were found in your CSV.");
        }
      }
    });
  };

  const runStrategy = () => {
    console.log("🔵 Run button clicked!");
    console.log("Current rows.length:", rows.length);
    
    if (!rows.length) {
      alert("❌ Please upload a CSV file first!");
      return;
    }
    
    console.log(`🚀 Running strategy "${strategy}" on ${rows.length} rows...`);
    const fn = STRATEGIES[strategy];
    const out = fn(rows);
    console.log(`✅ Generated ${out.length} signals:`, out.slice(0, 3));
    setSignals(out);
    
    if (out.length === 0) {
      alert("⚠️ Strategy ran but generated 0 signals. Try a different strategy or check your data.");
    }
  };

  const saveSignals = async () => {
    const batch = signals.map((s: any) => ({
      id: `${today}-${strategy}-${s.symbol}`,
      date: today,
      symbol: s.symbol,
      strategy,
      side: s.side,
      score: s.score,
      entry: s.entry,
      target: s.target,
      stopLoss: s.stopLoss,
      riskReward: s.riskReward,
      details: { why: s.why, csvFileName }
    }));
    await db.signals.bulkPut(batch);
    alert(`✅ Saved ${batch.length} signals for ${today}\n\nClick "View History" to see all saved signals.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">IntraQ – CSV → Signals (PWA)</h1>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => {
                if (viewMode === "generate") {
                  loadHistory();
                  setViewMode("history");
                } else {
                  setViewMode("generate");
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded text-sm"
            >
              {viewMode === "generate" ? "📋 View History" : "⬅ Back to Generate"}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 hover:text-slate-100 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        {viewMode === "generate" && (
          <>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="block text-sm bg-slate-900 rounded p-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) parseCsv(f);
                }}
              />
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as StrategyName)}
                className="bg-slate-800 px-3 py-2 rounded"
              >
                {Object.keys(STRATEGIES).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={runStrategy}
                className="bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded disabled:opacity-50"
                disabled={!rows.length}
              >
                Run
              </button>
              <button
                onClick={saveSignals}
                className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded disabled:opacity-50"
                disabled={!signals.length}
              >
                Save Signals
              </button>
            </div>

            <div className="text-sm opacity-80">
              {rows.length ? (
                <span className="text-green-400 font-semibold">✓ {rows.length} rows loaded - Ready to run!</span>
              ) : (
                "Upload a CSV (e.g., MW Pre-Open CSV)"
              )}
            </div>
          </>
        )}

        {viewMode === "generate" && !!signals.length && (
          <div className="bg-slate-900 rounded p-3 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-300">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Symbol</th>
                  <th className="text-left p-2">Side</th>
                  <th className="text-right p-2">Entry ₹</th>
                  <th className="text-right p-2">Target ₹</th>
                  <th className="text-right p-2">Stop Loss ₹</th>
                  <th className="text-center p-2">R:R</th>
                  <th className="text-left p-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s: any, i: number) => (
                  <tr key={s.symbol} className="border-t border-slate-800 hover:bg-slate-800">
                    <td className="p-2 text-slate-400">{i+1}</td>
                    <td className="p-2 font-semibold text-sky-300">{s.symbol}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${s.side === 'LONG' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                        {s.side}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono">{s.entry?.toFixed(2) ?? '-'}</td>
                    <td className="p-2 text-right font-mono text-emerald-400">{s.target?.toFixed(2) ?? '-'}</td>
                    <td className="p-2 text-right font-mono text-red-400">{s.stopLoss?.toFixed(2) ?? '-'}</td>
                    <td className="p-2 text-center text-xs text-slate-400">{s.riskReward ?? '-'}</td>
                    <td className="p-2 text-xs text-slate-400">{s.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "generate" && !!signals.length && (
          <div className="bg-slate-900 rounded p-4 text-sm space-y-2">
            <h3 className="font-semibold text-slate-200">📊 How to Use These Signals for Intraday Trading:</h3>
            <ul className="space-y-1 text-slate-400 text-xs">
              <li>• <strong className="text-slate-300">Top 5 signals</strong> have the highest probability (best score)</li>
              <li>• <strong className="text-emerald-400">Entry Price</strong>: Buy/Sell at or near this price (IEP from pre-open)</li>
              <li>• <strong className="text-emerald-400">Target Price</strong>: Book profits when price reaches this level (2.5% gain)</li>
              <li>• <strong className="text-red-400">Stop Loss</strong>: Exit immediately if price hits this (1.2% loss) - protect capital!</li>
              <li>• <strong className="text-slate-300">R:R 1:2.1</strong> = Risk ₹1 to potentially make ₹2.1 (good risk-reward ratio)</li>
              <li>• <strong className="text-yellow-400">LONG</strong> = Buy signal | <strong className="text-red-400">SHORT</strong> = Sell signal</li>
              <li>• Always use <strong>stop loss orders</strong> - never trade without them!</li>
            </ul>
          </div>
        )}

        {viewMode === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">📋 Saved Signals History</h2>
              <div className="text-sm text-slate-400">
                {savedSignals.length} saved session{savedSignals.length !== 1 ? 's' : ''}
              </div>
            </div>

            {savedSignals.length === 0 ? (
              <div className="bg-slate-900 rounded p-8 text-center text-slate-400">
                <p>No saved signals yet.</p>
                <p className="text-sm mt-2">Generate signals and click "Save Signals" to build your history.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedSignals.map((batch: any) => (
                  <div key={batch.id} className="bg-slate-900 rounded overflow-hidden">
                    {/* Batch Header - Collapsible */}
                    <div 
                      className="flex items-center justify-between p-4 hover:bg-slate-800 cursor-pointer"
                      onClick={() => toggleBatch(batch.id)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <button className="text-slate-400 hover:text-slate-200 text-lg">
                          {batch.isExpanded ? '▼' : '▶'}
                        </button>
                        <div>
                          <div className="font-semibold text-slate-200">
                            {batch.date} <span className="text-slate-400 font-normal">({batch.csvFileName})</span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {batch.strategy} • {batch.signals.length} signals
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => runBacktest(batch)}
                          disabled={backtestingBatchId === batch.id}
                          className={`${
                            batch.signals.some((s: any) => s.backtest)
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-purple-600 hover:bg-purple-700'
                          } disabled:bg-purple-800 disabled:opacity-50 text-white px-3 py-1 rounded text-sm`}
                        >
                          {backtestingBatchId === batch.id 
                            ? '⏳ Running...' 
                            : batch.signals.some((s: any) => s.backtest)
                            ? '✅ Backtested'
                            : '🎯 Backtest'}
                        </button>
                        {batch.signals.some((s: any) => s.backtest) && (
                          <button
                            onClick={() => setExpandedInsightsBatchId(
                              expandedInsightsBatchId === batch.id ? null : batch.id
                            )}
                            className={`${
                              expandedInsightsBatchId === batch.id
                                ? 'bg-indigo-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            } text-white px-3 py-1 rounded text-sm transition-colors`}
                          >
                            {expandedInsightsBatchId === batch.id ? '📊 Hide Insights' : '📊 Insights'}
                          </button>
                        )}
                        <button
                          onClick={() => downloadCSV(batch)}
                          className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-sm"
                        >
                          📥 CSV
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${batch.signals.length} signals from ${batch.date}?`)) {
                              deleteBatch(batch.id);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Insights Panel - Slide in from right */}
                    {batch.isExpanded && expandedInsightsBatchId === batch.id && batch.signals.some((s: any) => s.backtest) && (
                      <div className="border-t border-slate-800 overflow-hidden">
                        <div className="animate-slideInRight">
                          <Insights 
                            batchId={batch.id} 
                            date={batch.date}
                          />
                        </div>
                      </div>
                    )}

                    {/* Expanded Signals Table */}
                    {batch.isExpanded && (
                      <div className="border-t border-slate-800 p-4 space-y-4">
                        {/* Statistics - Show if backtest data exists */}
                        {batch.signals.some((s: any) => s.backtest) && (
                          <>
                            {/* Data Source Indicator */}
                            {(() => {
                              const hasRealData = batch.signals.some((s: any) => s.backtest?.usedRealData);
                              const realDataCount = batch.signals.filter((s: any) => s.backtest?.usedRealData).length;
                              const totalBacktested = batch.signals.filter((s: any) => s.backtest).length;
                              
                              if (hasRealData && realDataCount === totalBacktested) {
                                // All real data
                                return (
                                  <div className="bg-green-900/20 border border-green-700/50 rounded p-3 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                      <div className="text-green-300 text-sm font-medium mb-1">✅ Using Real Historical Data</div>
                                      <div className="text-green-200/70 text-xs">
                                        Results based on actual market data from Dhan API ({realDataCount}/{totalBacktested} stocks)
                                      </div>
                                    </div>
                                  </div>
                                );
                              } else if (hasRealData) {
                                // Mixed data
                                return (
                                  <div className="bg-blue-900/20 border border-blue-700/50 rounded p-3 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                      <div className="text-blue-300 text-sm font-medium mb-1">📊 Mixed Data Sources</div>
                                      <div className="text-blue-200/70 text-xs">
                                        Real data: {realDataCount} stocks | Mock data: {totalBacktested - realDataCount} stocks (API fetch failed)
                                      </div>
                                    </div>
                                  </div>
                                );
                              } else {
                                // All mock data
                                return (
                                  <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-3 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                      <div className="text-yellow-300 text-sm font-medium mb-1">⚠️ Using Simulated Data</div>
                                      <div className="text-yellow-200/70 text-xs">
                                        Results based on mock data. Configure Dhan API in Settings for real historical market data.
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            })()}
                            <div className="bg-slate-800 rounded p-4 flex gap-6">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">Entry Hit:</span>
                                <span className="text-lg font-semibold text-emerald-400">
                                  {batch.signals.filter((s: any) => s.backtest?.entryHit).length} / {batch.signals.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">Target Hit:</span>
                                <span className="text-lg font-semibold text-green-400">
                                  {batch.signals.filter((s: any) => s.backtest?.targetHit).length} / {batch.signals.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">Win Rate:</span>
                                <span className="text-lg font-semibold text-yellow-400">
                                  {batch.signals.filter((s: any) => s.backtest?.entryHit).length > 0
                                    ? ((batch.signals.filter((s: any) => s.backtest?.targetHit).length / 
                                        batch.signals.filter((s: any) => s.backtest?.entryHit).length) * 100).toFixed(1)
                                    : '0'}%
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        <table className="w-full text-sm">
                          <thead className="text-slate-300">
                            <tr>
                              <th className="text-left p-2">#</th>
                              <th className="text-left p-2">Symbol</th>
                              <th className="text-left p-2">Side</th>
                              <th className="text-right p-2">Entry ₹</th>
                              <th className="text-right p-2">Target ₹</th>
                              <th className="text-right p-2">Stop Loss ₹</th>
                              <th className="text-center p-2">R:R</th>
                              <th className="text-right p-2">Score</th>
                              {batch.signals.some((s: any) => s.backtest) && (
                                <>
                                  <th className="text-center p-2">Hit</th>
                                  <th className="text-center p-2">Target</th>
                                  <th className="text-center p-2">SL</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {batch.signals.map((s: any, i: number) => (
                              <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-800">
                                <td className="p-2 text-slate-400">{i+1}</td>
                                <td className="p-2 font-semibold text-sky-300">{s.symbol}</td>
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs ${s.side === 'LONG' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                                    {s.side}
                                  </span>
                                </td>
                                <td className="p-2 text-right font-mono">{s.entry?.toFixed(2) ?? '-'}</td>
                                <td className="p-2 text-right font-mono text-emerald-400">{s.target?.toFixed(2) ?? '-'}</td>
                                <td className="p-2 text-right font-mono text-red-400">{s.stopLoss?.toFixed(2) ?? '-'}</td>
                                <td className="p-2 text-center text-xs text-slate-400">{s.riskReward ?? '-'}</td>
                                <td className="p-2 text-right text-slate-400">{s.score?.toFixed(2) ?? '-'}</td>
                                {batch.signals.some((sig: any) => sig.backtest) && (
                                  <>
                                    <td className={`p-2 text-center text-xs font-medium ${
                                      s.backtest?.entryHit ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-400'
                                    }`}>
                                      {s.backtest?.entryHit ? s.backtest.entryHitTime : '✗'}
                                    </td>
                                    <td className={`p-2 text-center text-xs font-medium ${
                                      s.backtest?.targetHit ? 'bg-green-900/30 text-green-300' : 'text-slate-500'
                                    }`}>
                                      {s.backtest?.targetHit ? s.backtest.targetHitTime : '-'}
                                    </td>
                                    <td className={`p-2 text-center text-xs font-medium ${
                                      s.backtest?.slHit ? 'bg-red-900/30 text-red-400' : 'text-slate-500'
                                    }`}>
                                      {s.backtest?.slHit ? s.backtest.slHitTime : '-'}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs opacity-70">
          Tip: Deploy to Netlify → Open in Safari → Share → Add to Home Screen (iOS PWA).
        </p>
      </div>

      {/* Settings Modal */}
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
