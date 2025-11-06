import { db, TBacktest } from "./db";

export async function runMockBacktest(strategy: string, from: string, to: string) {
  const sigs = await db.signals
    .where("strategy").equals(strategy)
    .and(s => s.date >= from && s.date <= to)
    .toArray();

  const trades = sigs.length;
  const winRate = 0.55;
  const pnlPct = +(trades * 0.6).toFixed(2);

  const result: TBacktest = {
    strategy, from, to, trades, winRate: +(winRate*100).toFixed(1), pnlPct,
    notes: "Mock – replace with real OHLC backtest logic"
  };

  await db.backtests.add(result);
  return result;
}