// signalMetrics.ts
// Technical indicator calculations for signal enhancement

export type Side = 'LONG' | 'SHORT';

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BaseSignalRow {
  symbol: string;
  side: Side;
  entry: number;
  target: number;
  stopLoss: number;
  rr: number;
  score: number;
  prevClose: number;
  preOpenPrice: number;
  preOpenVolume: number;
  prevDayHigh?: number;
  prevDayLow?: number;
  avg30dVolume?: number;
  currentPrice?: number;
  vwap?: number;
}

export interface IndicatorContext {
  symbolDaily: Candle[];
  indexDaily: Candle[];
  sectorDaily?: Candle[];
  sectorName?: string;
  sectorPerf1D?: number;
  sectorPerf5D?: number;
  sectorPerf20D?: number;
  avg30dVolume?: number;
  turnoverValue?: number;
}

export interface EnhancedSignalRow extends BaseSignalRow {
  gapPercent: number;
  preMarketVolumeSurge: number;
  atr14: number;
  volatilityRank: number;
  prevDayHigh: number;
  prevDayLow: number;
  nearDayHigh: boolean;
  nearDayLow: boolean;
  ema5: number;
  ema20: number;
  ema50: number;
  trendStatus: 'Strong Uptrend' | 'Weak Uptrend' | 'Consolidation' | 'Downtrend';
  relativeStrength20D: number;
  vwapDistancePercent: number | null;
  sectorScore: number | null;
  liquidityRating: 'LOW' | 'MEDIUM' | 'HIGH';
}

// ---------- Small helpers ----------

function safeDiv(numerator: number, denominator: number): number {
  if (!denominator || !isFinite(denominator)) return 0;
  return numerator / denominator;
}

function percentChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

// ---------- 1. GAP % ----------

export function calculateGapPercent(prevClose: number, preOpenPrice: number): number {
  return percentChange(prevClose, preOpenPrice);
}

// ---------- 2. Pre-market Volume Surge % ----------

export function calculatePreMarketVolumeSurge(
  preOpenVolume: number,
  avg30dVolume: number | undefined
): number {
  if (!avg30dVolume) return 0;
  return safeDiv(preOpenVolume, avg30dVolume) * 100;
}

// ---------- 3. ATR(14) ----------

export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const today = candles[i];
    const yesterday = candles[i - 1];
    const highLow = today.high - today.low;
    const highClose = Math.abs(today.high - yesterday.close);
    const lowClose = Math.abs(today.low - yesterday.close);
    const tr = Math.max(highLow, highClose, lowClose);
    trs.push(tr);
  }

  const recent = trs.slice(-period);
  const sum = recent.reduce((acc, v) => acc + v, 0);
  return sum / period;
}

// ---------- 4. Volatility Rank (0–100) ----------

export function calculateVolatilityRank(atr: number, lastClose: number): number {
  if (!lastClose) return 0;
  const atrPercent = (atr / lastClose) * 100;
  const normalized = Math.max(0, Math.min(10, atrPercent));
  return (normalized / 10) * 100;
}

// ---------- 5. Previous Day High / Low & "near" flags ----------

export function getPrevDayHighLow(candles: Candle[]): { high: number; low: number } {
  if (!candles.length) return { high: 0, low: 0 };
  const last = candles[candles.length - 1];
  return { high: last.high, low: last.low };
}

export function isNearLevel(
  price: number,
  level: number,
  thresholdPercent = 0.5
): boolean {
  if (!level) return false;
  const diffPercent = Math.abs(percentChange(level, price));
  return diffPercent <= thresholdPercent;
}

// ---------- 6. EMAs & Trend Status ----------

export function calculateEMA(candles: Candle[], period: number): number {
  if (candles.length < period) return 0;

  const k = 2 / (period + 1);
  let ema = candles[0].close;

  for (let i = 1; i < candles.length; i++) {
    const close = candles[i].close;
    ema = close * k + ema * (1 - k);
  }

  return ema;
}

export function getTrendStatus(ema5: number, ema20: number, ema50: number): EnhancedSignalRow['trendStatus'] {
  if (ema5 > ema20 && ema20 > ema50) return 'Strong Uptrend';
  if (ema5 > ema20 && ema20 <= ema50) return 'Weak Uptrend';
  if (ema5 < ema20 && ema20 < ema50) return 'Downtrend';
  return 'Consolidation';
}

// ---------- 7. Relative Strength vs Index (20-day) ----------

export function calculateRelativeStrength20D(
  symbolDaily: Candle[],
  indexDaily: Candle[],
  lookback = 20
): number {
  if (symbolDaily.length < lookback + 1 || indexDaily.length < lookback + 1) return 0;

  const sStart = symbolDaily[symbolDaily.length - 1 - lookback].close;
  const sEnd = symbolDaily[symbolDaily.length - 1].close;
  const iStart = indexDaily[indexDaily.length - 1 - lookback].close;
  const iEnd = indexDaily[indexDaily.length - 1].close;

  const stockPct = percentChange(sStart, sEnd);
  const indexPct = percentChange(iStart, iEnd);

  return stockPct - indexPct;
}

// ---------- 8. VWAP Distance % ----------

export function calculateVWAPDistancePercent(
  currentPrice: number | undefined,
  vwap: number | undefined
): number | null {
  if (!currentPrice || !vwap) return null;
  return percentChange(vwap, currentPrice);
}

// ---------- 9. Sector Score (0–10) ----------

export function calculateSectorScore(
  perf1D?: number,
  perf5D?: number,
  perf20D?: number
): number | null {
  if (perf1D == null && perf5D == null && perf20D == null) return null;

  const w1 = 0.5;
  const w5 = 0.3;
  const w20 = 0.2;

  const s1 = perf1D ?? 0;
  const s5 = perf5D ?? 0;
  const s20 = perf20D ?? 0;

  const weighted = s1 * w1 + s5 * w5 + s20 * w20;

  const clamped = Math.max(-5, Math.min(5, weighted));
  const normalized = (clamped + 5) / 10;
  return parseFloat((normalized * 10).toFixed(2));
}

// ---------- 10. Liquidity Rating ----------

export function calculateLiquidityRating(
  avg30dVolume: number | undefined,
  price: number
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (!avg30dVolume || !price) return 'LOW';

  const turnover = avg30dVolume * price;
  if (turnover >= 50_00_00_000) return 'HIGH';
  if (turnover >= 10_00_00_000) return 'MEDIUM';
  return 'LOW';
}

// ---------- Main: enrich a row with all metrics ----------

export function enrichSignalRow(
  row: BaseSignalRow,
  ctx: IndicatorContext
): EnhancedSignalRow {
  const lastClose = ctx.symbolDaily[ctx.symbolDaily.length - 1]?.close ?? row.prevClose;

  const gapPercent = calculateGapPercent(row.prevClose, row.preOpenPrice);

  const avgVol = row.avg30dVolume ?? ctx.avg30dVolume ?? 0;
  const preMarketVolumeSurge = calculatePreMarketVolumeSurge(row.preOpenVolume, avgVol);

  const atr14 = calculateATR(ctx.symbolDaily, 14);
  const volatilityRank = calculateVolatilityRank(atr14, lastClose);

  const prev = getPrevDayHighLow(ctx.symbolDaily);
  const prevDayHigh = row.prevDayHigh ?? prev.high;
  const prevDayLow = row.prevDayLow ?? prev.low;

  const cmp = row.currentPrice ?? row.entry;
  const nearDayHigh = isNearLevel(cmp, prevDayHigh, 0.5);
  const nearDayLow = isNearLevel(cmp, prevDayLow, 0.5);

  const ema5 = calculateEMA(ctx.symbolDaily, 5);
  const ema20 = calculateEMA(ctx.symbolDaily, 20);
  const ema50 = calculateEMA(ctx.symbolDaily, 50);
  const trendStatus = getTrendStatus(ema5, ema20, ema50);

  const relativeStrength20D = calculateRelativeStrength20D(
    ctx.symbolDaily,
    ctx.indexDaily,
    20
  );

  const vwapDistancePercent = calculateVWAPDistancePercent(
    row.currentPrice ?? row.entry,
    row.vwap
  );

  const sectorScore = calculateSectorScore(
    ctx.sectorPerf1D,
    ctx.sectorPerf5D,
    ctx.sectorPerf20D
  );

  const liquidityRating = calculateLiquidityRating(avgVol, cmp);

  return {
    ...row,
    gapPercent,
    preMarketVolumeSurge,
    atr14,
    volatilityRank,
    prevDayHigh,
    prevDayLow,
    nearDayHigh,
    nearDayLow,
    ema5,
    ema20,
    ema50,
    trendStatus,
    relativeStrength20D,
    vwapDistancePercent,
    sectorScore,
    liquidityRating,
  };
}

