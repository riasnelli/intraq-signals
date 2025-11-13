// momentumScore.ts
// Scoring for "Momentum (Gap-Up Near High)" signals.
//
// Final score is 0–10 where:
//   0   = very weak candidate
//   10  = strongest gap-up, near-high, highly liquid candidate

export type LiquidityLabel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MomentumScoreParams {
  // % pre-market gap vs previous close, e.g. 0.46 for TMPV
  gapPct: number;
  // Indicative Equilibrium Price / pre-open price
  iep: number;
  // 52-week high (optional – will fall back to neutral if missing)
  nm52wHigh?: number | null;
  // Either provide a label…
  liquidityLabel?: LiquidityLabel;
  // …or let the function infer it from average daily turnover (₹ Crores)
  avgTurnoverCr?: number | null;
}

// ---------- Internal helpers ----------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Turnover-based liquidity bucketing (tweak these thresholds if you like)
function inferLiquidityLabel(avgTurnoverCr?: number | null): LiquidityLabel {
  if (!avgTurnoverCr || !isFinite(avgTurnoverCr)) return 'LOW';
  if (avgTurnoverCr >= 50) return 'HIGH';   // 50 Cr+ per day
  if (avgTurnoverCr >= 10) return 'MEDIUM'; // 10–50 Cr
  return 'LOW';
}

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

// ---------- Public scoring function ----------

/**
 * Calculate momentum score for a LONG signal.
 *
 * Components (each 0–10):
 *   - gapScore:  size of bullish gap (capped at +5%)
 *   - proxScore: proximity to 52-week high (0–50% below high mapped to 10→0)
 *   - liqScore:  liquidity score from HIGH/MEDIUM/LOW
 *
 * Weights:
 *   finalScore = gapScore * 0.5 + proxScore * 0.3 + liqScore * 0.2
 */
export function calculateMomentumScore(params: MomentumScoreParams): number {
  const { gapPct, iep, nm52wHigh, liquidityLabel, avgTurnoverCr } = params;

  // --- 1) Gap score (0–10) ----------------------------------------------
  // Ignore negative gaps for LONG (we only reward bullish gaps).
  const rawGap = Math.max(0, gapPct);
  const GAP_CAP = 5; // % – anything >5% treated as full strength.
  const cappedGap = clamp(rawGap, 0, GAP_CAP);
  const gapScore = (cappedGap / GAP_CAP) * 10; // 0–10

  // --- 2) Proximity to 52W high (0–10) -----------------------------------
  // Distance from high in %, below high is positive magnitude.
  let dist: number;
  if (nm52wHigh && isFinite(nm52wHigh) && nm52wHigh > 0) {
    dist = Math.abs((iep / nm52wHigh - 1) * 100); // e.g. 2% below → 2
  } else {
    // No 52W high data → neutral distance = 25%
    dist = 25;
  }
  const DIST_CAP = 50; // treat "50%+ below high" as worst case.
  const cappedDist = clamp(dist, 0, DIST_CAP);
  // Map 0–50% distance → 10–0 score
  const proxScore = ((DIST_CAP - cappedDist) / DIST_CAP) * 10; // 0–10

  // --- 3) Liquidity score (0–10) -----------------------------------------
  const liqLabel = liquidityLabel ?? inferLiquidityLabel(avgTurnoverCr);
  const liqScore = liquidityScore(liqLabel); // 2 / 6 / 10

  // --- 4) Final weighted score (0–10) ------------------------------------
  const finalScore =
    gapScore * 0.5 +  // gap is most important
    proxScore * 0.3 + // then proximity to 52W high
    liqScore * 0.2;   // then liquidity

  // Round to 2 decimals for UI
  return parseFloat(finalScore.toFixed(2));
}

