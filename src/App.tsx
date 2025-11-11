
import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { db } from "./db";
import { STRATEGIES, StrategyName, Row } from "./strategies";
import { toNum } from "./utils";

type Raw = Record<string, string>;

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [strategy, setStrategy] = useState<StrategyName>("Momentum (Gap-Up Near High)");
  const [signals, setSignals] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"generate"|"history">("generate");
  const [savedSignals, setSavedSignals] = useState<any[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date().toISOString().slice(0,10), []);

  const loadHistory = async () => {
    const all = await db.signals.orderBy("date").reverse().toArray();
    // Group by date + strategy
    const grouped = all.reduce((acc: any, signal: any) => {
      const key = `${signal.date}_${signal.strategy}`;
      if (!acc[key]) {
        acc[key] = {
          id: key,
          date: signal.date,
          strategy: signal.strategy,
          signals: [],
        };
      }
      acc[key].signals.push(signal);
      return acc;
    }, {});
    setSavedSignals(Object.values(grouped));
  };

  const deleteBatch = async (batchId: string) => {
    const [date, ...strategyParts] = batchId.split('_');
    const strategy = strategyParts.join('_');
    
    const toDelete = await db.signals
      .where('date').equals(date)
      .and(s => s.strategy === strategy)
      .toArray();
    
    const ids = toDelete.map(s => s.id).filter(Boolean) as string[];
    await db.signals.bulkDelete(ids);
    
    loadHistory(); // Refresh
    alert(`✅ Deleted ${ids.length} signals from ${date}`);
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
      details: { why: s.why }
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
                    {/* Batch Header Row */}
                    <div className="flex items-center justify-between p-4 hover:bg-slate-800 cursor-pointer"
                         onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}>
                      <div className="flex items-center gap-4 flex-1">
                        <button className="text-slate-400 hover:text-slate-200">
                          {expandedBatch === batch.id ? '▼' : '▶'}
                        </button>
                        <div>
                          <div className="font-semibold text-slate-200">
                            {batch.date}
                          </div>
                          <div className="text-xs text-slate-400">
                            {batch.strategy} • {batch.signals.length} signals
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => downloadCSV(batch)}
                          className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                        >
                          📥 CSV
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${batch.signals.length} signals from ${batch.date}?`)) {
                              deleteBatch(batch.id);
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Expanded Signals Table */}
                    {expandedBatch === batch.id && (
                      <div className="border-t border-slate-800 p-4">
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
    </div>
  );
}
