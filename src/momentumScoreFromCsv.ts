// momentumScoreFromCsv.ts
// Score calculation for "Momentum (Gap-Up Near High)" based on
// NSE pre-open CSV like: Nifty50-MW-Pre-Open-Market-13-Nov-2025.csv

export type LiquidityLabel = 'LOW' | 'MEDIUM' | 'HIGH';

// Shape of the raw CSV row (only columns we need)
// Adjust names if you renamed them during parsing.
export interface NsePreopenCsvRow {
  'SYMBOL \n': string;
  'PREV. CLOSE \n': string | number;
  'IEP \n': string | number;
  'VALUE \n (₹ Crores)': string | number;
  'NM 52W H \n': string | number | null;
}

// ---------- Small helpers ----------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(raw: string | number | null | undefined): number {
  if (raw == null) return NaN;
  if (typeof raw === 'number') return raw;
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// Turnover-based liquidity label from VALUE (₹ Crores)
function inferLiquidityLabelFromTurnoverCr(
  avgTurnoverCr?: number | null
): LiquidityLabel {
  if (!avgTurnoverCr || !Number.isFinite(avgTurnoverCr)) return 'LOW';
  if (avgTurnoverCr >= 50) return 'HIGH';   // 50 Cr+ per day
  if (avgTurnoverCr >= 10) return 'MEDIUM'; // 10–50 Cr
  return 'LOW';
}

// Map liquidity label to a 0–10 score
function liquidityScore(label: LiquidityLabel): number {
  switch (label) {
    case 'HIGH':
      return 10;
    case 'MEDIUM':
      return 6;
    default:
      return 2;
  }
}

// ---------- Core numeric scoring (what we actually "run") ----------

export interface MomentumScoreNumericParams {
  prevClose: number;      // previous close price
  iep: number;            // IEP / pre-open price
  nm52wHigh?: number;     // 52-week high (optional)
  avgTurnoverCr?: number; // VALUE (₹ Crores) from CSV
}

/**
 * Calculate momentum score (0–10) for a LONG signal.
 *
 * Components (each 0–10):
 *   gapScore  : size of bullish gap (capped at +5%)
 *   proxScore : proximity to 52-week high (0–50% below high mapped to 10→0)
 *   liqScore  : liquidity score from HIGH/MEDIUM/LOW
 *
 * Weights:
 *   finalScore = gapScore * 0.5 + proxScore * 0.3 + liqScore * 0.2
 */
export function calculateMomentumScoreNumeric(
  params: MomentumScoreNumericParams
): number {
  const { prevClose, iep, nm52wHigh, avgTurnoverCr } = params;

  // --- 1) Gap score (0–10) -------------------------------------------
  const gapPct =
    prevClose > 0 ? ((iep - prevClose) / prevClose) * 100 : 0;

  // Only positive gaps rewarded for LONG
  const rawGap = Math.max(0, gapPct);
  const GAP_CAP = 5; // % – anything >5% treated as full strength
  const cappedGap = clamp(rawGap, 0, GAP_CAP);
  const gapScore = (cappedGap / GAP_CAP) * 10; // 0–10

  // --- 2) Proximity to 52W high (0–10) -------------------------------
  let dist: number;
  if (nm52wHigh && Number.isFinite(nm52wHigh) && nm52wHigh > 0) {
    // % below high, as positive magnitude
    dist = Math.abs((iep / nm52wHigh - 1) * 100);
  } else {
    // No 52W high data → neutral assumed distance = 25%
    dist = 25;
  }
  const DIST_CAP = 50; // treat "50%+ below high" as worst case
  const cappedDist = clamp(dist, 0, DIST_CAP);
  // Map 0–50% distance → 10–0 score
  const proxScore = ((DIST_CAP - cappedDist) / DIST_CAP) * 10; // 0–10

  // --- 3) Liquidity score (0–10) -------------------------------------
  const liqLabel = inferLiquidityLabelFromTurnoverCr(avgTurnoverCr);
  const liqScore = liquidityScore(liqLabel); // 2 / 6 / 10

  // --- 4) Final weighted score (0–10) --------------------------------
  const finalScore =
    gapScore * 0.5 +  // gap is most important
    proxScore * 0.3 + // then proximity to 52W high
    liqScore * 0.2;   // then liquidity

  return Number(finalScore.toFixed(2));
}

// ---------- Convenience: directly from CSV row -----------------------

export function calculateMomentumScoreFromCsvRow(
  row: NsePreopenCsvRow
): number {
  const prevClose = parseNumber(row['PREV. CLOSE \n']);
  const iep = parseNumber(row['IEP \n']);
  const nmHigh = parseNumber(row['NM 52W H \n']);
  const valueCr = parseNumber(row['VALUE \n (₹ Crores)']);

  return calculateMomentumScoreNumeric({
    prevClose,
    iep,
    nm52wHigh: Number.isFinite(nmHigh) ? nmHigh : undefined,
    avgTurnoverCr: Number.isFinite(valueCr) ? valueCr : undefined,
  });
}

