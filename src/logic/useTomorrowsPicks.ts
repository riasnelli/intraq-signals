// useTomorrowsPicks.ts
import { useMemo } from "react";
import {
  SignalRow,
  generateTomorrowsPicks,
  TomorrowsPicksResult,
} from "./tomorrowsPicks";
import { TSignal } from "../db";

// Convert TSignal to SignalRow format expected by the engine
function convertSignalToRow(signal: TSignal): SignalRow | null {
  // Skip if missing critical data
  if (!signal.gapPercent || !signal.atr14 || !signal.trendStatus || 
      signal.relativeStrength20D === undefined || signal.vwapDistancePercent === null ||
      !signal.liquidityRating) {
    return null;
  }

  return {
    symbol: signal.symbol,
    side: signal.side,
    entry: signal.entry,
    target: signal.target,
    stopLoss: signal.stopLoss,
    rr: signal.riskReward || "1:2",
    score: signal.score,
    gapPct: signal.gapPercent,
    volSurgePct: signal.preMarketVolumeSurge,
    atr: signal.atr14,
    volRank: signal.volatilityRank,
    nearHigh: signal.nearDayHigh || false,
    nearLow: signal.nearDayLow || false,
    trend: signal.trendStatus,
    rs20d: signal.relativeStrength20D,
    vwapPct: signal.vwapDistancePercent,
    liquidity: signal.liquidityRating,
    hitEntry: signal.backtest?.entryHit,
    hitTarget: signal.backtest?.targetHit,
    hitStopLoss: signal.backtest?.slHit,
    hitTime: signal.backtest?.entryHitTime,
    stopTime: signal.backtest?.slHitTime,
  };
}

export function useTomorrowsPicks(signals: TSignal[]): TomorrowsPicksResult {
  return useMemo(() => {
    // Convert signals to rows, filtering out incomplete ones
    const rows = signals
      .map(convertSignalToRow)
      .filter((r): r is SignalRow => r !== null);

    if (rows.length === 0) {
      return {
        topPicks: [],
        avoidList: [],
        regime: {
          volatility: "MEDIUM",
          trendBias: "MIXED",
          notes: ["No data available yet"],
        },
        filtersUsed: [],
      };
    }

    return generateTomorrowsPicks(rows, {
      minGapPct: 1.0,
      minRs20d: 3.0,
      minScore: 3.0,
    });
  }, [signals]);
}

