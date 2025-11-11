export type Row = {
  symbol: string;
  prev_close: number;
  iep: number;
  pct_chg?: number;
  nm_52w_h?: number;
  nm_52w_l?: number;
  value_cr?: number;
  final_qty?: number;
};

export type Signal = {
  symbol: string;
  side: "LONG"|"SHORT";
  score: number;
  why: string;
  entry: number;
  target: number;
  stopLoss: number;
  riskReward?: string;
};

const near52High = (r: Row) =>
  r.nm_52w_h ? (r.iep / r.nm_52w_h - 1) * 100 : -999;

export function momentumGapLong(rows: Row[]): Signal[] {
  return rows
    .filter(r => r.iep > 0 && r.prev_close > 0)
    .map(r => {
      const gapPct = ((r.iep - r.prev_close)/r.prev_close)*100;
      const near = near52High(r);
      const liq = Math.log1p(r.value_cr ?? 0);
      const score = (gapPct*0.6) + ((-near)*0.2) + (liq*0.8);
      
      // Intraday levels for LONG
      const entry = r.iep;
      const targetPct = 2.5; // 2.5% target for momentum
      const stopPct = 1.2;   // 1.2% stop loss
      const target = entry * (1 + targetPct/100);
      const stopLoss = entry * (1 - stopPct/100);
      const rr = (targetPct / stopPct).toFixed(1);
      
      return { 
        symbol: r.symbol, 
        side: "LONG" as const, 
        score, 
        why: `Gap ${gapPct.toFixed(2)}%, ${near.toFixed(2)}% from 52W-H`,
        entry: +entry.toFixed(2),
        target: +target.toFixed(2),
        stopLoss: +stopLoss.toFixed(2),
        riskReward: `1:${rr}`
      };
    })
    .filter(s => s.score > 0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,25);
}

export function gapDownWeakShort(rows: Row[]): Signal[] {
  return rows
    .filter(r => r.iep > 0 && r.prev_close > 0)
    .map(r => {
      const gapPct = ((r.iep - r.prev_close)/r.prev_close)*100;
      const belowHigh = near52High(r) < -10 ? 1 : 0;
      const liq = Math.log1p(r.value_cr ?? 0);
      const raw = (-gapPct)*0.7 + belowHigh*0.5 + liq*0.8;
      
      // Intraday levels for SHORT
      const entry = r.iep;
      const targetPct = 2.5; // 2.5% target for short
      const stopPct = 1.2;   // 1.2% stop loss
      const target = entry * (1 - targetPct/100);
      const stopLoss = entry * (1 + stopPct/100);
      const rr = (targetPct / stopPct).toFixed(1);
      
      return { 
        symbol: r.symbol, 
        side: "SHORT" as const, 
        score: raw, 
        why: `Gap ${gapPct.toFixed(2)}%, far from 52W-H`,
        entry: +entry.toFixed(2),
        target: +target.toFixed(2),
        stopLoss: +stopLoss.toFixed(2),
        riskReward: `1:${rr}`
      };
    })
    .filter(s => s.score > 0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,25);
}

export const STRATEGIES = {
  "Momentum (Gap-Up Near High)": momentumGapLong,
  "Weakness (Gap-Down Far Below High)": gapDownWeakShort,
};

export type StrategyName = keyof typeof STRATEGIES;