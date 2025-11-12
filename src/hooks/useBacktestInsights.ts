import { useEffect, useMemo, useState } from "react";
import { db, TSignal } from "../db";
import sectorMap from "../utils/sectorMap";

type ScoreBand = { label: string; min: number; max: number };

const DEFAULT_SCORE_BANDS: ScoreBand[] = [
  { label: "≤2", min: -Infinity, max: 2 },
  { label: "2–4", min: 2, max: 4 },
  { label: "4–6", min: 4, max: 6 },
  { label: "6–8", min: 6, max: 8 },
  { label: "8–10", min: 8, max: 10 },
  { label: "10+", min: 10, max: Infinity },
];

const TIME_BUCKETS_MIN = [0, 15, 30, 60, 120, Infinity];

export function useBacktestInsights(batchId: string, date: string, scoreBands = DEFAULT_SCORE_BANDS) {
  const [rows, setRows] = useState<TSignal[]>([]);

  useEffect(() => {
    let ok = true;
    (async () => {
      const signals = await db.signals
        .where("date")
        .equals(date)
        .toArray();
      
      // Filter by batchId if needed (batchId format: date_strategy_csvFileName)
      const filtered = signals.filter(s => {
        if (!batchId) return true;
        const csvFile = s.details?.csvFileName || "Unknown.csv";
        const key = `${s.date}_${s.strategy}_${csvFile}`;
        return key === batchId;
      });

      // Add sector info
      const withSectors = filtered.map(s => ({
        ...s,
        sector: s.sector ?? sectorMap[s.symbol] ?? "UNKNOWN"
      }));

      if (ok) setRows(withSectors);
    })();
    return () => {
      ok = false;
    };
  }, [batchId, date]);

  // Heatmap: win-rate by score band
  const heatmap = useMemo(() => {
    const bins = scoreBands.map(b => ({ 
      band: b.label, 
      total: 0, 
      wins: 0, 
      losses: 0, 
      winRate: 0 
    }));
    
    rows.forEach(r => {
      if (!r.backtest) return;
      
      const band = scoreBands.find(b => r.score >= b.min && r.score < b.max);
      if (!band) return;
      
      const bin = bins.find(x => x.band === band.label)!;
      if (r.backtest.outcome === "target") {
        bin.wins++;
        bin.total++;
      } else if (r.backtest.outcome === "sl") {
        bin.losses++;
        bin.total++;
      }
    });
    
    bins.forEach(b => {
      b.winRate = b.total ? +(100 * b.wins / b.total).toFixed(1) : 0;
    });
    
    return bins;
  }, [rows, scoreBands]);

  // Histogram: time to target
  const histogram = useMemo(() => {
    const buckets = TIME_BUCKETS_MIN.slice(0, -1).map((start, i) => {
      const end = TIME_BUCKETS_MIN[i + 1];
      return {
        label: `${start}-${end === Infinity ? "∞" : end}min`,
        start,
        end,
        count: 0
      };
    });
    
    rows.forEach(r => {
      if (!r.backtest?.timeToTarget) return;
      const mins = r.backtest.timeToTarget;
      const b = buckets.find(x => mins >= x.start && mins < x.end);
      if (b) b.count++;
    });
    
    return buckets;
  }, [rows]);

  // Sector win-rate
  const sectorWin = useMemo(() => {
    const agg = new Map<string, { wins: number; total: number }>();
    
    rows.forEach(r => {
      if (!r.backtest) return;
      
      const key = r.sector || "UNKNOWN";
      const cur = agg.get(key) ?? { wins: 0, total: 0 };
      
      if (r.backtest.outcome === "target" || r.backtest.outcome === "sl") {
        cur.total++;
      }
      if (r.backtest.outcome === "target") {
        cur.wins++;
      }
      
      agg.set(key, cur);
    });
    
    const arr = Array.from(agg.entries()).map(([sector, { wins, total }]) => ({
      sector,
      total,
      wins,
      winRate: total ? +(100 * wins / total).toFixed(1) : 0,
    }));
    
    arr.sort((a, b) => b.winRate - a.winRate);
    return arr;
  }, [rows]);

  // Auto-suggestions
  const suggestions = useMemo(() => {
    const topBands = heatmap
      .filter(b => b.total >= 3)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 2)
      .map(b => b.band);
    
    const topSectors = sectorWin
      .filter(s => s.total >= 3)
      .slice(0, 3)
      .map(s => s.sector);
    
    const fast = histogram.find(h => h.label.startsWith("0-15"))?.count ?? 0;
    const next = histogram.find(h => h.label.startsWith("15-30"))?.count ?? 0;
    
    return {
      scoreBandsPreferred: topBands,
      sectorsPreferred: topSectors,
      timeRecommendation:
        fast + next > 0
          ? "Enter by 10:00 AM; exit if no progress by 10:30 AM"
          : "Use only opening range trades",
    };
  }, [heatmap, sectorWin, histogram]);

  return { heatmap, histogram, sectorWin, suggestions, rows };
}

