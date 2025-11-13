
import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { db } from "./db";
import { STRATEGIES, StrategyName, Row } from "./strategies";
import { toNum } from "./utils";
import Settings from "./components/Settings";
import Insights from "./components/Insights";
import { backtestBatch } from "./backtest";
import { enrichSignalRow, BaseSignalRow, IndicatorContext } from "./signalMetrics";
import { generateMockCandles, generateNiftyCandles } from "./mockCandleData";
import sectorMap from "./utils/sectorMap";

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
  const [backtestProgress, setBacktestProgress] = useState<{current: number, total: number} | null>(null);
  const [expandedInsightsBatchId, setExpandedInsightsBatchId] = useState<string | null>(null);
  const [pendingRankings, setPendingRankings] = useState<Map<string, {chatGpt?: number, perplexity?: number, deepSeek?: number}>>(new Map());
  const [showIndicators, setShowIndicators] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date().toISOString().slice(0,10), []);

  const loadHistory = async () => {
    // Preserve current expanded state
    const currentExpandedIds = new Set(
      savedSignals.filter(b => b.isExpanded).map(b => b.id)
    );
    
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
          isExpanded: currentExpandedIds.has(key), // Restore previous expanded state
        };
      }
      acc[key].signals.push(signal);
      return acc;
    }, {});
    const batches = Object.values(grouped);
    
    // If no tabs were previously expanded, expand the first one by default
    if (currentExpandedIds.size === 0 && batches.length > 0) {
      batches[0].isExpanded = true;
    }
    
    setSavedSignals(batches);
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

  // Calculate final rank based on AI rankings (average of rankings, lower is better)
  const calculateFinalRank = (chatGpt?: number, perplexity?: number, deepSeek?: number): number | undefined => {
    const rankings = [chatGpt, perplexity, deepSeek].filter(r => r !== undefined) as number[];
    if (rankings.length === 0) return undefined;
    
    // Average ranking
    const avgRank = rankings.reduce((sum, r) => sum + r, 0) / rankings.length;
    return Math.round(avgRank * 10) / 10; // Round to 1 decimal
  };

  // Update AI ranking locally (doesn't save to DB yet)
  const updateAIRank = (signalId: string, aiSource: 'chatGpt' | 'perplexity' | 'deepSeek', rank?: number) => {
    setPendingRankings(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(signalId) || {};
      
      // Update the specific AI rank
      if (aiSource === 'chatGpt') current.chatGpt = rank;
      else if (aiSource === 'perplexity') current.perplexity = rank;
      else if (aiSource === 'deepSeek') current.deepSeek = rank;
      
      newMap.set(signalId, current);
      return newMap;
    });
  };

  // Save all pending rankings to database
  const saveRankings = async () => {
    if (pendingRankings.size === 0) return;
    
    const updates = [];
    for (const [signalId, rankings] of pendingRankings.entries()) {
      const signal = await db.signals.get(signalId);
      if (!signal) continue;
      
      // Apply pending changes
      if (rankings.chatGpt !== undefined) signal.chatGptRank = rankings.chatGpt;
      if (rankings.perplexity !== undefined) signal.perplexityRank = rankings.perplexity;
      if (rankings.deepSeek !== undefined) signal.deepSeekRank = rankings.deepSeek;
      
      // Recalculate final rank
      signal.finalRank = calculateFinalRank(signal.chatGptRank, signal.perplexityRank, signal.deepSeekRank);
      
      updates.push(signal);
    }
    
    await db.signals.bulkPut(updates);
    setPendingRankings(new Map()); // Clear pending changes
    loadHistory(); // Refresh to show saved rankings
  };

  // Get the current value for a ranking (pending or saved)
  const getRankingValue = (signal: any, aiSource: 'chatGpt' | 'perplexity' | 'deepSeek'): number | undefined => {
    const pending = pendingRankings.get(signal.id);
    if (pending && pending[aiSource] !== undefined) {
      return pending[aiSource];
    }
    // Return saved value
    if (aiSource === 'chatGpt') return signal.chatGptRank;
    if (aiSource === 'perplexity') return signal.perplexityRank;
    if (aiSource === 'deepSeek') return signal.deepSeekRank;
  };

  // Check if backtest can run (market must be closed)
  const canRunBacktest = (date: string): { allowed: boolean, message?: string } => {
    const signalDate = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    signalDate.setHours(0, 0, 0, 0);
    
    // Past dates always allowed
    if (signalDate < today) {
      return { allowed: true };
    }
    
    // Today - check time
    if (signalDate.getTime() === today.getTime()) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      const dataAvailableTime = 16 * 60; // 4:00 PM = 16:00
      
      if (currentTimeMinutes < dataAvailableTime) {
        return { 
          allowed: false, 
          message: `⏰ Backtest only available after 4:00 PM IST\n\nCurrent time: ${now.toLocaleTimeString('en-IN')}\n\nWait until market closes and data becomes available.`
        };
      }
      return { allowed: true };
    }
    
    // Future date
    return { 
      allowed: false, 
      message: `❌ Cannot backtest future date: ${date}`
    };
  };

  const runBacktest = async (batch: any) => {
    // Check if backtest is allowed (time-based check)
    const timeCheck = canRunBacktest(batch.date);
    if (!timeCheck.allowed) {
      alert(timeCheck.message);
      return;
    }
    
    // Check if backtest already exists
    const hasBacktest = batch.signals.some((s: any) => s.backtest);
    if (hasBacktest) {
      const rerun = confirm(
        `Backtest data already exists for this batch.\n\nNote: Results are deterministic and won't change.\n\nDo you want to re-run anyway?`
      );
      if (!rerun) return;
    }

    setBacktestingBatchId(batch.id);
    setBacktestProgress({ current: 0, total: batch.signals.length });
    
    try {
      // Pass progress callback to backtestBatch
      const results = await backtestBatch(
        batch.signals,
        (current, total) => setBacktestProgress({ current, total })
      );
      
      await loadHistory(); // Reload to get updated data
      
      // Check data sources
      const dhanCount = results.filter(r => r.backtest?.dataSource === 'dhan').length;
      const yfinanceCount = results.filter(r => r.backtest?.dataSource === 'yfinance').length;
      const noDataCount = results.filter(r => r.backtest?.noData).length;
      const totalCount = results.length;
      
      let message = `✅ Backtest completed for ${totalCount} signals!\n\n`;
      
      if (dhanCount > 0) {
        message += `🟢 Dhan API: ${dhanCount} stocks\n`;
      }
      if (yfinanceCount > 0) {
        message += `🟡 Yahoo Finance: ${yfinanceCount} stocks (darker rows)\n`;
      }
      if (noDataCount > 0) {
        message += `⚪ No data: ${noDataCount} stocks (blank rows)\n`;
      }
      
      message += `\n📊 ${dhanCount + yfinanceCount} stocks backtested successfully!`;
      
      alert(message);
    } catch (error) {
      console.error('Backtest error:', error);
      alert('❌ Backtest failed. Check console for details.');
    } finally {
      setBacktestingBatchId(null);
      setBacktestProgress(null);
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
    console.log(`🔄 Calculating technical indicators for ${signals.length} signals...`);
    
    // Generate Nifty50 candles once (used for all stocks)
    const niftyCandles = generateNiftyCandles(60);
    
    const batch = signals.map((s: any) => {
      // Find the original row data for this symbol
      const originalRow = rows.find(r => r.symbol === s.symbol);
      const prevClose = originalRow?.prev_close ?? s.entry * 0.99;
      const preOpenPrice = originalRow?.iep ?? s.entry;
      
      // Generate mock candle data for this symbol
      const symbolCandles = generateMockCandles(s.symbol, s.entry, 60);
      
      // Calculate realistic volumes from turnover (value_cr is in crores)
      const valueCr = originalRow?.value_cr ?? 10; // Default 10 crores
      const avgPrice = (prevClose + preOpenPrice) / 2;
      
      // Estimate volumes: turnover (₹) / price = volume
      // value_cr is in crores (1 crore = 10,000,000)
      const estimatedDailyVolume = (valueCr * 10000000) / avgPrice;
      
      // Pre-market typically sees 5-20% of daily volume
      // Use final_qty if available, else estimate 10-15% of daily
      const preMarketVolumeFactor = 0.1 + (Math.random() * 0.05); // 10-15%
      const preOpenVolume = originalRow?.final_qty 
        ? originalRow.final_qty * 1000 // Multiply by 1000 if final_qty is in '000s
        : estimatedDailyVolume * preMarketVolumeFactor;
      
      // 30-day average is typically similar to estimated daily (with some variance)
      const avg30dVolume = estimatedDailyVolume * (0.8 + Math.random() * 0.4); // 80-120% of estimate
      
      // Calculate realistic VWAP based on gap direction
      // VWAP typically sits between prev_close and current_price
      // For gap-up (bullish): VWAP is below current price (IEP)
      // For gap-down: VWAP is above current price
      const gapPercent = ((preOpenPrice - prevClose) / prevClose) * 100;
      let vwap: number;
      
      if (gapPercent > 0) {
        // Gap-up: VWAP between prev_close and entry (typically 40-70% of the way)
        const vwapPosition = 0.4 + Math.random() * 0.3; // 40-70%
        vwap = prevClose + (preOpenPrice - prevClose) * vwapPosition;
      } else if (gapPercent < 0) {
        // Gap-down: VWAP between entry and prev_close (typically 30-60% of the way)
        const vwapPosition = 0.3 + Math.random() * 0.3; // 30-60%
        vwap = preOpenPrice + (prevClose - preOpenPrice) * vwapPosition;
      } else {
        // No gap: VWAP very close to current price (±0.2%)
        vwap = s.entry * (0.998 + Math.random() * 0.004);
      }
      
      // Create base signal row for enrichment
      const baseSignal: BaseSignalRow = {
        symbol: s.symbol,
        side: s.side,
        entry: s.entry,
        target: s.target,
        stopLoss: s.stopLoss,
        rr: parseFloat(s.riskReward || '0'),
        score: s.score,
        prevClose: prevClose,
        preOpenPrice: preOpenPrice,
        preOpenVolume: preOpenVolume,
        currentPrice: s.entry,
        avg30dVolume: avg30dVolume,
        vwap: vwap,
      };
      
      // Create indicator context
      const context: IndicatorContext = {
        symbolDaily: symbolCandles,
        indexDaily: niftyCandles,
        sectorName: sectorMap[s.symbol] || 'UNKNOWN',
        avg30dVolume: 1000000,
        // Mock sector performance (can be enhanced with real data later)
        sectorPerf1D: -1 + Math.random() * 2, // -1% to +1%
        sectorPerf5D: -3 + Math.random() * 6, // -3% to +3%
        sectorPerf20D: -5 + Math.random() * 10, // -5% to +5%
      };
      
      // Enrich with technical indicators
      const enriched = enrichSignalRow(baseSignal, context);
      
      return {
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
        sector: sectorMap[s.symbol] || 'UNKNOWN',
        details: { why: s.why, csvFileName },
        // Technical indicators
        gapPercent: enriched.gapPercent,
        preMarketVolumeSurge: enriched.preMarketVolumeSurge,
        atr14: enriched.atr14,
        volatilityRank: enriched.volatilityRank,
        prevDayHigh: enriched.prevDayHigh,
        prevDayLow: enriched.prevDayLow,
        nearDayHigh: enriched.nearDayHigh,
        nearDayLow: enriched.nearDayLow,
        ema5: enriched.ema5,
        ema20: enriched.ema20,
        ema50: enriched.ema50,
        trendStatus: enriched.trendStatus,
        relativeStrength20D: enriched.relativeStrength20D,
        vwapDistancePercent: enriched.vwapDistancePercent,
        sectorScore: enriched.sectorScore,
        liquidityRating: enriched.liquidityRating,
      };
    });
    
    await db.signals.bulkPut(batch);
    console.log(`✅ Saved ${batch.length} signals with technical indicators`);
    alert(`✅ Saved ${batch.length} signals for ${today}\n\nTechnical indicators calculated for all stocks.\n\nClick "View History" to see results.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-2 py-2">
      <div className="w-full space-y-3">
        <header className="flex items-center justify-between px-2">
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
                      className="flex items-center justify-between px-3 py-2 hover:bg-slate-800 cursor-pointer"
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
                      
                      {/* Backtest Stats - Visible even when collapsed */}
                      {batch.signals.some((s: any) => s.backtest) && (
                        <div className="flex items-center gap-6 mr-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-center">
                            <div className="text-lg font-bold text-emerald-400">
                              {batch.signals.filter((s: any) => s.backtest?.entryHit).length} / {batch.signals.filter((s: any) => s.backtest && !s.backtest.noData).length}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Entry Hit</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="text-lg font-bold text-emerald-400">
                              {batch.signals.filter((s: any) => s.backtest?.targetHit).length} / {batch.signals.filter((s: any) => s.backtest && !s.backtest.noData).length}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Target Hit</div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className={`text-lg font-bold ${
                              (() => {
                                const backtested = batch.signals.filter((s: any) => s.backtest && !s.backtest.noData && s.backtest.outcome !== 'no_trigger');
                                const wins = batch.signals.filter((s: any) => s.backtest && !s.backtest.noData && s.backtest.outcome === 'target');
                                const winRate = backtested.length > 0 ? (wins.length / backtested.length * 100) : 0;
                                return winRate >= 50 ? 'text-emerald-400' : winRate >= 30 ? 'text-yellow-400' : 'text-red-400';
                              })()
                            }`}>
                              {(() => {
                                const backtested = batch.signals.filter((s: any) => s.backtest && !s.backtest.noData && s.backtest.outcome !== 'no_trigger');
                                const wins = batch.signals.filter((s: any) => s.backtest && !s.backtest.noData && s.backtest.outcome === 'target');
                                const winRate = backtested.length > 0 ? (wins.length / backtested.length * 100).toFixed(1) : '0.0';
                                return `${winRate}%`;
                              })()}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Win Rate</div>
                          </div>
                        </div>
                      )}
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
                      <div className="border-t border-slate-800 p-2 space-y-3">
                        {/* Action Buttons - Only visible when expanded */}
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-800/50">
                          {(() => {
                            const timeCheck = canRunBacktest(batch.date);
                            const isDisabled = !timeCheck.allowed || backtestingBatchId === batch.id;
                            
                            return (
                              <button
                                onClick={() => runBacktest(batch)}
                                disabled={isDisabled}
                                className={`${
                                  !timeCheck.allowed
                                    ? 'bg-slate-700/20 border-slate-600/50 text-slate-500'
                                    : batch.signals.some((s: any) => s.backtest)
                                    ? 'bg-green-600/20 border-green-600/50 text-green-400 hover:bg-green-600/30'
                                    : 'bg-purple-600/20 border-purple-600/50 text-purple-400 hover:bg-purple-600/30'
                                } disabled:opacity-50 disabled:cursor-not-allowed border px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors`}
                                title={
                                  !timeCheck.allowed 
                                    ? 'Backtest available after 4:00 PM IST' 
                                    : batch.signals.some((s: any) => s.backtest) 
                                    ? 'Backtest completed' 
                                    : 'Run backtest'
                                }
                              >
                                {!timeCheck.allowed ? (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Backtest (After 4 PM)
                                  </>
                                ) : backtestingBatchId === batch.id ? (
                                  <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {backtestProgress ? `Processing ${backtestProgress.current}/${backtestProgress.total}...` : 'Running...'}
                                  </>
                                ) : batch.signals.some((s: any) => s.backtest) ? (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Backtested
                                  </>
                                ) : (
                                  <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Backtest
                              </>
                                )}
                              </button>
                            );
                          })()}
                          
                          {batch.signals.some((s: any) => s.backtest) && (
                            <button
                              onClick={() => setExpandedInsightsBatchId(
                                expandedInsightsBatchId === batch.id ? null : batch.id
                              )}
                              className={`${
                                expandedInsightsBatchId === batch.id
                                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                                  : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-indigo-600/20 hover:border-indigo-600/50'
                              } border px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors`}
                              title="View insights dashboard"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              {expandedInsightsBatchId === batch.id ? 'Hide Insights' : 'Insights'}
                            </button>
                          )}
                          
                        <button
                          onClick={() => downloadCSV(batch)}
                            className="bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-sky-600/20 hover:border-sky-600/50 px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors"
                            title="Download as CSV"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            CSV
                        </button>
                          
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${batch.signals.length} signals from ${batch.date}?`)) {
                              deleteBatch(batch.id);
                            }
                          }}
                            className="bg-slate-700/50 border border-slate-600 text-slate-300 hover:bg-red-600/20 hover:border-red-600/50 hover:text-red-400 px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors"
                            title="Delete this batch"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                        
                        {/* Save Rankings Button - Only show when there are pending changes */}
                        {pendingRankings.size > 0 && (
                          <button
                            onClick={saveRankings}
                            className="bg-amber-600/20 border border-amber-600/50 text-amber-400 hover:bg-amber-600/30 px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors font-medium animate-pulse"
                            title={`Save ${pendingRankings.size} unsaved ranking(s)`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            Save ({pendingRankings.size})
                          </button>
                        )}
                        
                        {/* Toggle Technical Indicators */}
                        <button
                          onClick={() => setShowIndicators(!showIndicators)}
                          className={`${
                            showIndicators
                              ? 'bg-cyan-600/20 border-cyan-600/50 text-cyan-400'
                              : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-cyan-600/20 hover:border-cyan-600/50'
                          } border px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors`}
                          title={showIndicators ? 'Hide technical indicators' : 'Show 10 technical indicators'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          {showIndicators ? 'Hide Indicators' : 'Indicators'}
                        </button>
                        </div>
                        
                        {/* Statistics - Show if backtest data exists */}
                        {batch.signals.some((s: any) => s.backtest) && (
                          <>
                            {/* Data Source Indicator */}
                            {(() => {
                              const dhanCount = batch.signals.filter((s: any) => s.backtest?.dataSource === 'dhan').length;
                              const yfinanceCount = batch.signals.filter((s: any) => s.backtest?.dataSource === 'yfinance').length;
                              const noDataCount = batch.signals.filter((s: any) => s.backtest?.noData).length;
                              const totalCount = batch.signals.filter((s: any) => s.backtest).length;
                              
                              if (totalCount === 0) return null;
                              
                              return (
                                <div className="bg-slate-900/40 border border-slate-700/50 rounded px-3 py-2 flex items-center gap-4 text-xs">
                                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  <div className="flex items-center gap-4 text-slate-400">
                                    {dhanCount > 0 && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                          <circle cx="10" cy="10" r="8"/>
                                        </svg>
                                        Dhan: {dhanCount}
                                      </span>
                                    )}
                                    {yfinanceCount > 0 && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                          <circle cx="10" cy="10" r="8"/>
                                        </svg>
                                        Yahoo: {yfinanceCount}
                                      </span>
                                    )}
                                    {noDataCount > 0 && (
                                      <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                                          <circle cx="10" cy="10" r="8"/>
                                        </svg>
                                        No data: {noDataCount}
                                      </span>
                                    )}
                      </div>
                    </div>
                              );
                            })()}
                          </>
                        )}

                        <div className="w-full overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                          <thead className="text-slate-300">
                            <tr>
                              <th className="text-left px-2 py-1">#</th>
                              <th className="text-left px-2 py-1">Symbol</th>
                              <th className="text-left px-2 py-1">Side</th>
                              <th className="text-right px-2 py-1">Entry ₹</th>
                              <th className="text-right px-2 py-1">Target ₹</th>
                              <th className="text-right px-2 py-1">Stop Loss ₹</th>
                              <th className="text-center px-2 py-1">R:R</th>
                              <th className="text-right px-2 py-1">Score</th>
                              {/* Technical Indicators - Toggleable */}
                              {showIndicators && (
                                <>
                                  <th className="text-right px-2 py-1 text-xs text-cyan-400">Gap%</th>
                                  <th className="text-right px-2 py-1 text-xs text-cyan-400">Vol Surge%</th>
                                  <th className="text-right px-2 py-1 text-xs text-cyan-400">ATR</th>
                                  <th className="text-right px-2 py-1 text-xs text-cyan-400">Vol Rank</th>
                                  <th className="text-center px-2 py-1 text-xs text-cyan-400">Near High</th>
                                  <th className="text-center px-2 py-1 text-xs text-cyan-400">Near Low</th>
                                  <th className="text-center px-2 py-1 text-xs text-cyan-400">Trend</th>
                                  <th className="text-right px-2 py-1 text-xs text-cyan-400">RS 20D</th>
                                  <th className="text-right px-2 py-1 text-xs text-cyan-400">VWAP%</th>
                                  <th className="text-center px-2 py-1 text-xs text-cyan-400">Liquidity</th>
                                </>
                              )}
                              {batch.signals.some((s: any) => s.backtest) && (
                                <>
                                  <th className="text-center px-2 py-1">Hit</th>
                                  <th className="text-center px-2 py-1">Target</th>
                                  <th className="text-center px-2 py-1">SL</th>
                                </>
                              )}
                              {/* AI Rankings - Moved to extreme right */}
                              <th className="text-center px-2 py-1 text-xs text-blue-400">GPT</th>
                              <th className="text-center px-2 py-1 text-xs text-purple-400">Perp</th>
                              <th className="text-center px-2 py-1 text-xs text-green-400">Deep</th>
                              <th className="text-center px-2 py-1 text-xs text-yellow-400">Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...batch.signals]
                              .sort((a: any, b: any) => (b.score || 0) - (a.score || 0)) // Sort by score descending
                              .map((s: any, i: number) => {
                              // Determine row background based on data source and final rank
                              const isYFinance = s.backtest?.dataSource === 'yfinance';
                              const hasNoData = s.backtest?.noData;
                              const isTopRanked = s.finalRank && s.finalRank <= 5;
                              
                              let rowBgClass = '';
                              if (isTopRanked) {
                                rowBgClass = 'bg-yellow-900/10 border-l-2 border-yellow-500/50'; // Highlight top 5
                              } else if (isYFinance) {
                                rowBgClass = 'bg-slate-900/60'; // Darker for yfinance
                              } else if (hasNoData) {
                                rowBgClass = 'bg-slate-950/40 opacity-50'; // Very dim for no data
                              }
                              
                              return (
                                <tr key={s.id} className={`border-t border-slate-800 hover:bg-slate-800 ${rowBgClass}`}>
                                <td className="px-2 py-1 text-slate-400">{i+1}</td>
                                  <td className="px-2 py-1 font-semibold text-sky-300">
                                    {s.symbol}
                                    {isYFinance && <span className="ml-1 text-[10px] text-yellow-500" title="Data from Yahoo Finance">ⓨ</span>}
                                    {isTopRanked && <span className="ml-1 text-[10px] text-yellow-400" title="AI Top 5">⭐</span>}
                                  </td>
                                <td className="px-2 py-1">
                                  <span className={`px-2 py-0.5 rounded text-xs ${s.side === 'LONG' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                                    {s.side}
                                  </span>
                                </td>
                                <td className="px-2 py-1 text-right font-mono">{s.entry?.toFixed(2) ?? '-'}</td>
                                <td className="px-2 py-1 text-right font-mono text-emerald-400">{s.target?.toFixed(2) ?? '-'}</td>
                                <td className="px-2 py-1 text-right font-mono text-red-400">{s.stopLoss?.toFixed(2) ?? '-'}</td>
                                <td className="px-2 py-1 text-center text-xs text-slate-400">{s.riskReward ?? '-'}</td>
                                  <td className="px-2 py-1 text-right text-slate-400 font-semibold">{s.score?.toFixed(2) ?? '-'}</td>
                                  {/* Technical Indicators - Toggleable */}
                                  {showIndicators && (
                                    <>
                                      <td className="px-2 py-1 text-right text-xs text-cyan-300">{s.gapPercent?.toFixed(2) ?? '-'}</td>
                                      <td className="px-2 py-1 text-right text-xs text-cyan-300">{s.preMarketVolumeSurge?.toFixed(0) ?? '-'}</td>
                                      <td className="px-2 py-1 text-right text-xs text-cyan-300">{s.atr14?.toFixed(2) ?? '-'}</td>
                                      <td className="px-2 py-1 text-right text-xs text-cyan-300">{s.volatilityRank?.toFixed(0) ?? '-'}</td>
                                      <td className="px-2 py-1 text-center text-xs">
                                        <span className={s.nearDayHigh ? 'text-emerald-400' : 'text-slate-600'}>
                                          {s.nearDayHigh ? '✓' : '✗'}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-center text-xs">
                                        <span className={s.nearDayLow ? 'text-red-400' : 'text-slate-600'}>
                                          {s.nearDayLow ? '✓' : '✗'}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1 text-center text-xs">
                                        {s.trendStatus === 'Strong Uptrend' ? (
                                          <svg className="w-4 h-4 mx-auto text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                          </svg>
                                        ) : s.trendStatus === 'Weak Uptrend' ? (
                                          <svg className="w-4 h-4 mx-auto text-emerald-400 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                          </svg>
                                        ) : s.trendStatus === 'Downtrend' ? (
                                          <svg className="w-4 h-4 mx-auto text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4 h-4 mx-auto text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                                          </svg>
                                        )}
                                      </td>
                                      <td className="px-2 py-1 text-right text-xs text-cyan-300">{s.relativeStrength20D?.toFixed(2) ?? '-'}</td>
                                      <td className={`px-2 py-1 text-right text-xs ${
                                        s.vwapDistancePercent && s.vwapDistancePercent > 0 ? 'text-emerald-400' :
                                        s.vwapDistancePercent && s.vwapDistancePercent < 0 ? 'text-red-400' :
                                        'text-slate-500'
                                      }`}>
                                        {s.vwapDistancePercent?.toFixed(2) ?? '-'}
                                      </td>
                                      <td className="px-2 py-1 text-center text-xs">
                                        <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                                          s.liquidityRating === 'HIGH' ? 'bg-emerald-900/40 text-emerald-300' :
                                          s.liquidityRating === 'MEDIUM' ? 'bg-yellow-900/40 text-yellow-300' :
                                          'bg-slate-800 text-slate-400'
                                        }`}>
                                          {s.liquidityRating ?? 'LOW'}
                                        </span>
                                      </td>
                                    </>
                                  )}
                                  {batch.signals.some((sig: any) => sig.backtest) && (
                                    <>
                                      <td className={`px-2 py-1 text-center text-xs font-medium ${
                                        hasNoData ? 'text-slate-700' :
                                        s.backtest?.entryHit ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-400'
                                      }`}>
                                        {hasNoData ? '' : s.backtest?.entryHit ? s.backtest.entryHitTime : '✗'}
                                      </td>
                                      <td className={`px-2 py-1 text-center text-xs font-medium ${
                                        hasNoData ? 'text-slate-700' :
                                        s.backtest?.targetHit ? 'bg-green-900/30 text-green-300' : 'text-slate-500'
                                      }`}>
                                        {hasNoData ? '' : s.backtest?.targetHit ? s.backtest.targetHitTime : '-'}
                                      </td>
                                      <td className={`px-2 py-1 text-center text-xs font-medium ${
                                        hasNoData ? 'text-slate-700' :
                                        s.backtest?.slHit ? 'bg-red-900/30 text-red-400' : 'text-slate-500'
                                      }`}>
                                        {hasNoData ? '' : s.backtest?.slHit ? s.backtest.slHitTime : '-'}
                                      </td>
                                    </>
                                  )}
                                  {/* AI Rankings - Moved to extreme right */}
                                  <td className="p-1 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={getRankingValue(s, 'chatGpt') || ''}
                                      onChange={(e) => updateAIRank(s.id, 'chatGpt', e.target.value ? parseInt(e.target.value) : undefined)}
                                      className={`w-10 bg-slate-800 text-blue-300 text-center rounded px-1 py-0.5 text-xs border ${
                                        pendingRankings.has(s.id) && pendingRankings.get(s.id)?.chatGpt !== undefined
                                          ? 'border-blue-500 ring-1 ring-blue-500/50'
                                          : 'border-slate-700'
                                      } focus:border-blue-500 focus:outline-none`}
                                      placeholder="-"
                                    />
                                  </td>
                                  <td className="p-1 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={getRankingValue(s, 'perplexity') || ''}
                                      onChange={(e) => updateAIRank(s.id, 'perplexity', e.target.value ? parseInt(e.target.value) : undefined)}
                                      className={`w-10 bg-slate-800 text-purple-300 text-center rounded px-1 py-0.5 text-xs border ${
                                        pendingRankings.has(s.id) && pendingRankings.get(s.id)?.perplexity !== undefined
                                          ? 'border-purple-500 ring-1 ring-purple-500/50'
                                          : 'border-slate-700'
                                      } focus:border-purple-500 focus:outline-none`}
                                      placeholder="-"
                                    />
                                  </td>
                                  <td className="p-1 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      max="5"
                                      value={getRankingValue(s, 'deepSeek') || ''}
                                      onChange={(e) => updateAIRank(s.id, 'deepSeek', e.target.value ? parseInt(e.target.value) : undefined)}
                                      className={`w-10 bg-slate-800 text-green-300 text-center rounded px-1 py-0.5 text-xs border ${
                                        pendingRankings.has(s.id) && pendingRankings.get(s.id)?.deepSeek !== undefined
                                          ? 'border-green-500 ring-1 ring-green-500/50'
                                          : 'border-slate-700'
                                      } focus:border-green-500 focus:outline-none`}
                                      placeholder="-"
                                    />
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                      s.finalRank === 1 ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-500' :
                                      s.finalRank && s.finalRank <= 5 ? 'bg-yellow-900/20 text-yellow-400' :
                                      'text-slate-600'
                                    }`}>
                                      {s.finalRank || '-'}
                                    </span>
                                  </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
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
