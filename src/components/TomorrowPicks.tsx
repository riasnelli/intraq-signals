// TomorrowPicks.tsx
// AI-powered Tomorrow's Picks using Momentum Quality Score engine

import React from 'react';
import { TSignal } from '../db';
import { useTomorrowsPicks } from '../logic/useTomorrowsPicks';

interface TomorrowPicksProps {
  signals: TSignal[];
  onClose: () => void;
}

export default function TomorrowPicks({ signals, onClose }: TomorrowPicksProps) {
  const { topPicks, avoidList, regime, filtersUsed } = useTomorrowsPicks(signals);

  // Calculate basic backtest metrics
  const backtested = signals.filter(s => s.backtest && !s.backtest.noData);
  const entryHits = backtested.filter(s => s.backtest?.entryHit).length;
  const targetHits = backtested.filter(s => s.backtest?.targetHit).length;
  const slHits = backtested.filter(s => s.backtest?.slHit).length;
  const winRate = entryHits > 0 ? ((targetHits / entryHits) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                <span className="text-4xl">🎯</span>
                Tomorrow's Picks & Insights
              </h1>
              <p className="text-slate-400 mt-1">
                AI-powered recommendations using Momentum Quality Score
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/50 rounded-xl p-4">
              <div className="text-blue-300 text-sm font-medium">Entry Hit Rate</div>
              <div className="text-3xl font-bold text-blue-100 mt-1">
                {entryHits}/{backtested.length}
              </div>
              <div className="text-blue-400 text-xs mt-1">
                {backtested.length > 0 ? ((entryHits / backtested.length) * 100).toFixed(1) : '0'}% triggered
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-700/50 rounded-xl p-4">
              <div className="text-green-300 text-sm font-medium">Win Rate</div>
              <div className="text-3xl font-bold text-green-100 mt-1">{winRate}%</div>
              <div className="text-green-400 text-xs mt-1">
                {targetHits} targets / {entryHits} entries
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-700/50 rounded-xl p-4">
              <div className="text-red-300 text-sm font-medium">Stop Losses</div>
              <div className="text-3xl font-bold text-red-100 mt-1">{slHits}</div>
              <div className="text-red-400 text-xs mt-1">
                {entryHits > 0 ? ((slHits / entryHits) * 100).toFixed(1) : '0'}% stopped out
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/50 rounded-xl p-4">
              <div className="text-purple-300 text-sm font-medium">Market Regime</div>
              <div className="text-2xl font-bold text-purple-100 mt-1">{regime.volatility}</div>
              <div className="text-purple-400 text-xs mt-1">{regime.trendBias} bias</div>
            </div>
          </div>

          {/* Top 5 Picks */}
          <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-700/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-green-100 flex items-center gap-2">
                <span className="text-2xl">🌟</span>
                Tomorrow's Top 5 Picks
              </h2>
              {topPicks.length > 0 && (
                <div className="text-xs text-green-300 bg-green-900/30 px-3 py-1 rounded-full">
                  MQScore Range: {topPicks[topPicks.length-1].mqScore.toFixed(1)} - {topPicks[0].mqScore.toFixed(1)}
                </div>
              )}
            </div>
            <p className="text-xs text-green-300/70 mb-4">
              Filters: {filtersUsed.join(" • ")}
            </p>

            {topPicks.length === 0 ? (
              <div className="bg-slate-800/50 rounded-lg p-8 text-center">
                <p className="text-slate-400">No signals meet tomorrow's criteria. Review filters or wait for new data.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {topPicks.map((pick) => (
                  <li
                    key={pick.symbol}
                    className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-green-700/30 px-4 py-3 hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/50 flex items-center justify-center font-bold text-green-300">
                          {pick.rank}
                        </div>
                        <div>
                          <div className="font-semibold text-lg text-green-100 flex items-center gap-2">
                            <a
                              href={`https://in.tradingview.com/symbols/NSE-${pick.symbol}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-green-300 hover:underline transition-colors"
                              title={`View ${pick.symbol} on TradingView`}
                            >
                              {pick.symbol}
                            </a>
                            {pick.row.hitTarget && (
                              <span className="text-xs bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded">
                                ✓ Target Hit Today
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {pick.reasons
                              .slice(0, 5) // Show first 5 reasons
                              .map((r) =>
                                r.value ? `${r.label}: ${r.value}` : r.label
                              )
                              .join(" · ")}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-bold text-green-300">
                        {pick.mqScore.toFixed(2)}<span className="text-xs text-slate-500">/10</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        MQ Score
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Base: {pick.baseScore.toFixed(1)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Market Regime Analysis */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Market Regime Analysis
            </h2>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">Volatility</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{regime.volatility}</div>
              </div>
              <div className="flex-1 bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-400">Trend Bias</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{regime.trendBias}</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-300">
              {regime.notes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Avoid List */}
          <div className="bg-slate-900/60 border border-red-700/30 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4 flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              Avoid List
            </h2>
            {avoidList.length === 0 ? (
              <p className="text-slate-400">No strong avoid signals today. All setups look reasonable.</p>
            ) : (
              <ul className="space-y-2">
                {avoidList.map((item) => (
                  <li
                    key={item.symbol}
                    className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 text-sm"
                  >
                    <a
                      href={`https://in.tradingview.com/symbols/NSE-${item.symbol}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-red-100 hover:text-red-300 hover:underline transition-colors"
                      title={`View ${item.symbol} on TradingView`}
                    >
                      {item.symbol}
                    </a>
                    <span className="text-slate-400"> – </span>
                    <span className="text-slate-300">
                      {item.reasons
                        .map((r) => (r.value ? `${r.label} (${r.value})` : r.label))
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Trading Strategy */}
          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-blue-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">📈</span>
              Tomorrow's Trading Strategy
            </h2>
            <div className="space-y-3 text-slate-200">
              <div className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">1.</span>
                <div>
                  <div className="font-medium">Focus on MQScore {`>`} 6.0</div>
                  <div className="text-sm text-slate-400">
                    Momentum Quality Score combines Gap%, RS20D, Trend, Near High, and VWAP%. Higher = better setup quality.
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">2.</span>
                <div>
                  <div className="font-medium">Market Regime: {regime.volatility} Volatility</div>
                  <div className="text-sm text-slate-400">
                    {regime.volatility === 'HIGH' 
                      ? 'Use wider stops and smaller position sizes. Expect choppy moves.'
                      : regime.volatility === 'LOW'
                      ? 'Clean trends expected. Avoid scalping, let winners run.'
                      : 'Normal volatility. Standard risk management applies.'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">3.</span>
                <div>
                  <div className="font-medium">Trend Bias: {regime.trendBias}</div>
                  <div className="text-sm text-slate-400">
                    {regime.trendBias === 'BULLISH'
                      ? 'Favor LONG setups. Look for breakouts and buy-the-dip opportunities.'
                      : regime.trendBias === 'BEARISH'
                      ? 'Be cautious with LONGs. Wait for confirmation or consider sitting out.'
                      : 'Mixed signals. Be selective and wait for clear setups only.'}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-400 font-bold">4.</span>
                <div>
                  <div className="font-medium">Avoid List</div>
                  <div className="text-sm text-slate-400">
                    {avoidList.length > 0
                      ? `Skip ${avoidList.length} stocks: ${avoidList.slice(0, 5).map(a => a.symbol).join(', ')}${avoidList.length > 5 ? '...' : ''}`
                      : 'No specific avoids today. Trust your filters.'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pre-Market Checklist */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-700/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-indigo-100 mb-4 flex items-center gap-2">
              <span className="text-2xl">☑️</span>
              Pre-Market Checklist
            </h2>
            <div className="space-y-2 text-slate-300">
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Review pre-market movers & sector rotation</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Check Nifty50 trend & global cues</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Upload today's CSV and generate signals</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Review Top 5 picks - Focus on MQScore {`>`} 6.0</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Cross-check with Avoid List - Skip these symbols</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Set price alerts for Top 5 entry levels</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Review risk: Max 2-3% per trade, 10% total exposure</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-800/50 p-2 rounded transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-slate-600" />
                <span>Adjust stops based on {regime.volatility} volatility regime</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
