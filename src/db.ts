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