
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
  const inputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date().toISOString().slice(0,10), []);

  const parseCsv = (file: File) => {
    Papa.parse<Raw>(file, {
      header: true,
      complete: (res) => {
        const map = (r: Raw): Row => ({
          symbol: r["symbol"] || r["Symbol"] || "",
          prev_close: toNum(r["prev._close"] ?? r["Prev Close"]),
          iep: toNum(r["iep"] ?? r["IEP"]),
          pct_chg: toNum(r["pctchng"] ?? r["%Chng"]),
          nm_52w_h: toNum(r["nm_52w_h"] ?? r["52W High"]),
          nm_52w_l: toNum(r["nm_52w_l"] ?? r["52W Low"]),
          value_cr: toNum(r["value_\\n_(₹_crores)"] ?? r["Value (Cr)"]),
          final_qty: toNum(r["final_quantity"] ?? r["Final Qty"]),
        });
        const cleaned = res.data.map(map).filter(r => r.symbol);
        setRows(cleaned);
      }
    });
  };

  const runStrategy = () => {
    const fn = STRATEGIES[strategy];
    const out = fn(rows);
    setSignals(out);
  };

  const saveSignals = async () => {
    const batch = signals.map((s: any) => ({
      id: `${today}-${strategy}-${s.symbol}`,
      date: today,
      symbol: s.symbol,
      strategy,
      side: s.side,
      score: s.score,
      details: { why: s.why }
    }));
    await db.signals.bulkPut(batch);
    alert(`Saved ${batch.length} signals for ${today}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">IntraQ – CSV → Signals (PWA)</h1>
          <a href="https://github.com" target="_blank" className="text-xs opacity-70 underline">Docs</a>
        </header>

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
            className="bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded"
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
          {rows.length ? `${rows.length} rows loaded` : "Upload a CSV (e.g., MW Pre-Open CSV)"}
        </div>

        {!!signals.length && (
          <div className="bg-slate-900 rounded p-3 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-300">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Symbol</th>
                  <th className="text-left p-2">Side</th>
                  <th className="text-left p-2">Score</th>
                  <th className="text-left p-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s: any, i: number) => (
                  <tr key={s.symbol} className="border-t border-slate-800">
                    <td className="p-2">{i+1}</td>
                    <td className="p-2">{s.symbol}</td>
                    <td className="p-2">{s.side}</td>
                    <td className="p-2">{s.score.toFixed(2)}</td>
                    <td className="p-2">{s.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs opacity-70">
          Tip: Deploy to Netlify → Open in Safari → Share → Add to Home Screen (iOS PWA).
        </p>
      </div>
    </div>
  );
}
