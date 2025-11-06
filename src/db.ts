import Dexie, { Table } from "dexie";

export type TSignal = {
  id?: string;
  date: string;
  symbol: string;
  strategy: string;
  side: "LONG"|"SHORT";
  score: number;
  details?: Record<string, any>;
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