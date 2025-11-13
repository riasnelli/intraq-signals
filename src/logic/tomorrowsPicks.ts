// tomorrowsPicks.ts
// Tomorrow's Picks engine for your IntraQ PWA.
// Pure TypeScript – no external deps.

export type Side = "LONG" | "SHORT";
export type Trend = "Strong Uptrend" | "Weak Uptrend" | "Consolidation" | "Downtrend";
export type Liquidity = "LOW" | "MEDIUM" | "HIGH";

export interface SignalRow {
  symbol: string;
  side: Side;

  entry: number;
  target: number;
  stopLoss: number;
  rr: string;          // "1:2.1" etc.
  score: number;       // your momentum score (0–10)

  gapPct: number;      // Gap%
  volSurgePct?: number;
  atr: number;
  volRank?: number;

  nearHigh: boolean;
  nearLow: boolean;
  trend: Trend;        // "Strong Uptrend" | "Weak Uptrend" | "Consolidation" | "Downtrend"
  rs20d: number;       // RS 20D
  vwapPct: number;     // % above/below VWAP (positive = above)

  liquidity: Liquidity;

  // Optional intraday outcome flags (for backtest/insights)
  hitEntry?: boolean;
  hitTarget?: boolean;
  hitStopLoss?: boolean;
  hitTime?: string | null;   // "9:16 AM" etc.
  stopTime?: string | null;  // when SL was hit
}

export interface PickReason {
  label: string;
  value?: string | number;
}

export interface TomorrowPick {
  symbol: string;
  rank: number;
  mqScore: number;
  baseScore: number;
  row: SignalRow;
  reasons: PickReason[];
}

export interface AvoidItem {
  symbol: string;
  row: SignalRow;
  reasons: PickReason[];
}

export type VolatilityRegime = "LOW" | "MEDIUM" | "HIGH";
export type TrendBias = "BULLISH" | "BEARISH" | "MIXED";

export interface MarketRegimeSummary {
  volatility: VolatilityRegime;
  trendBias: TrendBias;
  notes: string[];
}

export interface TomorrowsPicksResult {
  topPicks: TomorrowPick[];
  avoidList: AvoidItem[];
  regime: MarketRegimeSummary;
  filtersUsed: string[];
}

// ---------- small helpers ----------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeAvg(values: number[]): number {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// map a value in [inMin, inMax] to 0–10
function normalizeTo10(value: number, inMin: number, inMax: number): number {
  const clamped = clamp(value, inMin, inMax);
  const ratio = (clamped - inMin) / (inMax - inMin || 1);
  return ratio * 10;
}

// ---------- Momentum Quality Score (0–10) ----------
//
// MQScore is AI-like: combines gap, RS, trend, near-high & VWAP.
//

export function calculateMomentumQualityScore(row: SignalRow): number {
  // 1) Gap score: 0–4% mapped to 0–10 (only positive gap matters for LONG)
  const rawGap = row.side === "LONG" ? Math.max(0, row.gapPct) : 0;
  const gapScore = normalizeTo10(rawGap, 0, 4);

  // 2) RS score: -2–8 mapped to 0–10
  const rsScore = normalizeTo10(row.rs20d, -2, 8);

  // 3) Trend score: Strong Uptrend=10, Weak Uptrend=7, Consolidation=5, Downtrend=0
  let trendScore = 5;
  if (row.trend === "Strong Uptrend") trendScore = 10;
  else if (row.trend === "Weak Uptrend") trendScore = 7;
  else if (row.trend === "Consolidation") trendScore = 5;
  else if (row.trend === "Downtrend") trendScore = 0;

  // 4) Near-high score: true=10, false=0 (only matters for LONG)
  const nearHighScore = row.side === "LONG" && row.nearHigh ? 10 : 0;

  // 5) VWAP score:  -0.5%–+1.5% mapped to 0–10, but only if above VWAP
  const vwapScore =
    row.vwapPct > 0 ? normalizeTo10(row.vwapPct, 0, 1.5) : 0;

  // Weights – tweak if needed
  const final =
    gapScore * 0.25 +
    rsScore * 0.25 +
    trendScore * 0.2 +
    nearHighScore * 0.2 +
    vwapScore * 0.1;

  return Number(final.toFixed(2));
}

// ---------- Market regime detection ----------

function detectMarketRegime(rows: SignalRow[]): MarketRegimeSummary {
  const atrs = rows.map((r) => r.atr);
  const gaps = rows.map((r) => r.gapPct);
  const rsValues = rows.map((r) => r.rs20d);

  const avgAtr = safeAvg(atrs);
  const avgGap = safeAvg(gaps);
  const avgRs = safeAvg(rsValues);

  let volatility: VolatilityRegime = "MEDIUM";
  if (avgAtr < 10) volatility = "LOW";
  else if (avgAtr > 50) volatility = "HIGH";

  let trendBias: TrendBias = "MIXED";
  const upCount = rows.filter((r) => r.trend === "Strong Uptrend" || r.trend === "Weak Uptrend").length;
  const downCount = rows.filter((r) => r.trend === "Downtrend").length;

  if (upCount > downCount * 1.5) trendBias = "BULLISH";
  else if (downCount > upCount * 1.5) trendBias = "BEARISH";

  const notes: string[] = [];
  notes.push(`Avg ATR: ${avgAtr.toFixed(2)}`);
  notes.push(`Avg Gap%: ${avgGap.toFixed(2)}%`);
  notes.push(`Avg RS20D: ${avgRs.toFixed(2)}`);
  notes.push(
    `Trend split – UP: ${upCount}, DOWN: ${downCount}, TOTAL: ${rows.length}`
  );

  if (volatility === "HIGH") {
    notes.push("High volatility: prefer partial positions & wider SL.");
  } else if (volatility === "LOW") {
    notes.push("Low volatility: avoid scalping, focus on clean trends.");
  }

  if (trendBias === "BULLISH") {
    notes.push("Bullish bias: favour LONG breakouts / buy-the-dip setups.");
  } else if (trendBias === "BEARISH") {
    notes.push("Bearish bias: cautious with LONGs; look for fails & reversals.");
  } else {
    notes.push("Mixed trend: be selective; avoid marginal setups.");
  }

  return { volatility, trendBias, notes };
}

// ---------- Core engine: picks + avoid list ----------

export function generateTomorrowsPicks(
  rows: SignalRow[],
  options?: {
    minGapPct?: number;
    minRs20d?: number;
    minScore?: number; // your base score
  }
): TomorrowsPicksResult {
  const {
    minGapPct = 1.0,
    minRs20d = 3.0,
    minScore = 3.0,
  } = options || {};

  // 1) Compute MQScore for all rows
  const withMQ = rows.map((row) => ({
    ...row,
    mqScore: calculateMomentumQualityScore(row),
  }));

  // 2) Tomorrow filters (LONG bias momentum strategy)
  const filtersUsed: string[] = [
    `Gap% >= ${minGapPct}`,
    `RS20D >= ${minRs20d}`,
    `Base Score >= ${minScore}`,
    "Trend = Strong/Weak Uptrend",
    "NearHigh preferred",
    "VWAP% >= 0",
  ];

  const candidates = withMQ.filter((r) => {
    if (r.side !== "LONG") return false;
    if (r.gapPct < minGapPct) return false;
    if (r.rs20d < minRs20d) return false;
    if (r.score < minScore) return false;
    if (r.trend !== "Strong Uptrend" && r.trend !== "Weak Uptrend") return false;
    if (r.vwapPct < 0) return false; // trading above VWAP
    // Add extra filter here if you ever use "LOW/MEDIUM/HIGH" liquidity
    return true;
  });

  // 3) Sort candidates by MQScore, then by base score & RS20D
  candidates.sort((a, b) => {
    if (b.mqScore !== a.mqScore) return b.mqScore - a.mqScore;
    if (b.score !== a.score) return b.score - a.score;
    if (b.rs20d !== a.rs20d) return b.rs20d - a.rs20d;
    return a.symbol.localeCompare(b.symbol);
  });

  // 4) Build top 5 picks
  const topPicks: TomorrowPick[] = candidates.slice(0, 5).map((row, idx) => {
    const reasons: PickReason[] = [
      { label: "Gap%", value: `${row.gapPct.toFixed(2)}%` },
      { label: "RS20D", value: row.rs20d.toFixed(2) },
      { label: "Trend", value: row.trend },
      { label: "Near High", value: row.nearHigh ? "Yes" : "No" },
      { label: "VWAP%", value: row.vwapPct.toFixed(2) },
      { label: "Base Score", value: row.score.toFixed(2) },
      { label: "MQScore", value: row.mqScore.toFixed(2) },
    ];

    return {
      symbol: row.symbol,
      rank: idx + 1,
      mqScore: row.mqScore,
      baseScore: row.score,
      row,
      reasons,
    };
  });

  // 5) Avoid list – mainly SL hits & weak RS/trend
  const avoidList: AvoidItem[] = withMQ
    .filter((r) => {
      const slHit = !!r.hitStopLoss || r.hitStopLoss === true;
      const weakRs = r.rs20d < 0;
      const badTrend = r.trend === "Downtrend";
      return slHit || weakRs || badTrend;
    })
    .map((row) => {
      const reasons: PickReason[] = [];
      if (row.hitStopLoss) {
        reasons.push({ label: "SL Hit Today", value: row.stopTime || "" });
      }
      if (row.rs20d < 0) {
        reasons.push({ label: "Weak RS20D", value: row.rs20d.toFixed(2) });
      }
      if (row.trend === "Downtrend") {
        reasons.push({ label: "Downtrend", value: "" });
      }
      if (!reasons.length) {
        reasons.push({ label: "Low conviction", value: "" });
      }
      return { symbol: row.symbol, row, reasons };
    });

  // 6) Market regime summary
  const regime = detectMarketRegime(rows);

  return {
    topPicks,
    avoidList,
    regime,
    filtersUsed,
  };
}

