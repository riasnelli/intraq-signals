import Dexie, { Table } from "dexie";

export type TSignal = {
  id?: string;
  date: string;
  symbol: string;
  strategy: string;
  side: "LONG"|"SHORT";
  score: number;
  entry: number;
  target: number;
  stopLoss: number;
  riskReward?: string;
  sector?: string;
  details?: Record<string, any>;
  // AI Recommendations (manual input from ChatGPT, Perplexity, DeepSeek)
  chatGptRank?: number;      // 1-5 ranking from ChatGPT
  perplexityRank?: number;   // 1-5 ranking from Perplexity
  deepSeekRank?: number;     // 1-5 ranking from DeepSeek
  finalRank?: number;        // Consolidated ranking (1-5) based on all 3 AIs
  // Technical Indicators (from signalMetrics.ts)
  gapPercent?: number;
  preMarketVolumeSurge?: number;
  atr14?: number;
  volatilityRank?: number;
  prevDayHigh?: number;
  prevDayLow?: number;
  nearDayHigh?: boolean;
  nearDayLow?: boolean;
  ema5?: number;
  ema20?: number;
  ema50?: number;
  trendStatus?: 'Strong Uptrend' | 'Weak Uptrend' | 'Consolidation' | 'Downtrend';
  relativeStrength20D?: number;
  vwapDistancePercent?: number | null;
  sectorScore?: number | null;
  liquidityRating?: 'LOW' | 'MEDIUM' | 'HIGH';
  backtest?: {
    entryHit: boolean;
    entryHitTime?: string;
    targetHit: boolean;
    targetHitTime?: string;
    slHit: boolean;
    slHitTime?: string;
    outcome?: "target" | "sl" | "no_trigger";
    timeToTarget?: number;
    timeToSL?: number;
    usedRealData?: boolean;
    noData?: boolean;
    dataSource?: 'dhan' | 'yfinance';
  };
};

export type TBacktest = {
  id?: string;
  strategy: string;
  from: string;
  to: string;
  trades: number;
  winRate: number;
  pnlPct: number;
  notes?: string;
};

export class IntraDB extends Dexie {
  signals!: Table<TSignal, string>;
  backtests!: Table<TBacktest, string>;
  constructor() {
    super("intraq_signals");
    this.version(1).stores({
      signals: "&id, date, strategy, symbol",
      backtests: "++id, strategy, from, to"
    });
  }
}

export const db = new IntraDB();