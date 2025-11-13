// TomorrowPicks.tsx
// Analyzes today's backtest results to suggest tomorrow's trading strategy

import React, { useMemo } from 'react';
import { TSignal } from '../db';

interface TomorrowPicksProps {
  signals: TSignal[];
  onClose: () => void;
}

export default function TomorrowPicks({ signals, onClose }: TomorrowPicksProps) {
  // Analyze backtest results
  const analysis = useMemo(() => {
    const backtested = signals.filter(s => s.backtest && !s.backtest.noData);
    
    if (backtested.length === 0) {
      return null;
    }
    
    // 1. AI Ranking Performance
    const aiRankedStocks = backtested.filter(s => s.finalRank);
    const aiWins = aiRankedStocks.filter(s => s.backtest?.outcome === 'target');
    const aiWinRate = aiRankedStocks.length > 0 
      ? (aiWins.length / aiRankedStocks.length * 100).toFixed(1)
      : '0';
    
    const top5Stocks = aiRankedStocks.filter(s => s.finalRank && s.finalRank <= 5);
    const top5Wins = top5Stocks.filter(s => s.backtest?.outcome === 'target');
    const top5WinRate = top5Stocks.length > 0
      ? (top5Wins.length / top5Stocks.length * 100).toFixed(1)
      : '0';
    
    // 2. Technical Indicator Correlations
    const winners = backtested.filter(s => s.backtest?.outcome === 'target');
    const losers = backtested.filter(s => s.backtest?.outcome === 'sl');
    
    // Average indicators for winners vs losers
    const avgGapWinners = winners.reduce((sum, s) => sum + (s.gapPercent || 0), 0) / (winners.length || 1);
    const avgGapLosers = losers.reduce((sum, s) => sum + (s.gapPercent || 0), 0) / (losers.length || 1);
    
    const avgRSWinners = winners.reduce((sum, s) => sum + (s.relativeStrength20D || 0), 0) / (winners.length || 1);
    const avgRSLosers = losers.reduce((sum, s) => sum + (s.relativeStrength20D || 0), 0) / (losers.length || 1);
    
    const avgVolSurgeWinners = winners.reduce((sum, s) => sum + (s.preMarketVolumeSurge || 0), 0) / (winners.length || 1);
    const avgVolSurgeLosers = losers.reduce((sum, s) => sum + (s.preMarketVolumeSurge || 0), 0) / (losers.length || 1);
    
    // 3. Trend Performance
    const strongUptrend = backtested.filter(s => s.trendStatus === 'Strong Uptrend');
    const strongUptrendWins = strongUptrend.filter(s => s.backtest?.outcome === 'target');
    const strongUptrendWinRate = strongUptrend.length > 0
      ? (strongUptrendWins.length / strongUptrend.length * 100).toFixed(1)
      : '0';
    
    // 4. Best performers
    const bestPerformers = winners
      .sort((a, b) => {
        const timeA = a.backtest?.timeToTarget || 999;
        const timeB = b.backtest?.timeToTarget || 999;
        return timeA - timeB; // Fastest first
      })
      .slice(0, 3);
    
    // 5. Worst performers (for learning)
    const worstPerformers = losers.slice(0, 3);
    
    // 6. Overall stats
    const entryHits = backtested.filter(s => s.backtest?.entryHit).length;
    const targetHits = winners.length;
    const overallWinRate = entryHits > 0 
      ? (targetHits / entryHits * 100).toFixed(1)
      : '0';
    
    return {
      aiWinRate,
      top5WinRate,
      avgGapWinners,
      avgGapLosers,
      avgRSWinners,
      avgRSLosers,
      avgVolSurgeWinners,
      avgVolSurgeLosers,
      strongUptrendWinRate,
      bestPerformers,
      worstPerformers,
      overallWinRate,
      totalBacktested: backtested.length,
      totalWins: winners.length,
      totalLosses: losers.length,
    };
  }, [signals]);

  if (!analysis) {
    return (
      <div className="bg-slate-800/50 p-8 text-center">
        <p className="text-slate-400">No backtest data available. Run backtest first.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-6 space-y-6 border-b border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/20 p-2 rounded-lg">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">📊 Tomorrow's Picks - AI Strategy Insights</h2>
            <p className="text-sm text-slate-400">Based on today's backtest results & performance analysis</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors"
          title="Close insights"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
          <div className="text-3xl font-bold text-emerald-400">{analysis.overallWinRate}%</div>
          <div className="text-xs text-slate-400 mt-1">Overall Win Rate</div>
          <div className="text-xs text-slate-500 mt-2">{analysis.totalWins}W / {analysis.totalLosses}L</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
          <div className="text-3xl font-bold text-yellow-400">{analysis.top5WinRate}%</div>
          <div className="text-xs text-slate-400 mt-1">AI Top 5 Win Rate</div>
          <div className="text-xs text-slate-500 mt-2">⭐ Consensus picks</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
          <div className="text-3xl font-bold text-cyan-400">{analysis.strongUptrendWinRate}%</div>
          <div className="text-xs text-slate-400 mt-1">Strong Uptrend Win Rate</div>
          <div className="text-xs text-slate-500 mt-2">📈 EMA alignment</div>
        </div>
        <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-700">
          <div className="text-3xl font-bold text-indigo-400">{analysis.totalBacktested}</div>
          <div className="text-xs text-slate-400 mt-1">Stocks Tested</div>
          <div className="text-xs text-slate-500 mt-2">Today's sample</div>
        </div>
      </div>

      {/* Tomorrow's Strategy Recommendations */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: What Worked */}
        <div className="bg-slate-900/40 rounded-lg p-5 border border-emerald-900/30">
          <h3 className="text-lg font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ✅ What Worked Today
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Average Gap % (Winners)</span>
              <span className="font-bold text-emerald-400">+{analysis.avgGapWinners.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Avg RS 20D (Winners)</span>
              <span className="font-bold text-emerald-400">+{analysis.avgRSWinners.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Avg Vol Surge (Winners)</span>
              <span className="font-bold text-emerald-400">{analysis.avgVolSurgeWinners.toFixed(0)}%</span>
            </div>
            <div className="bg-emerald-900/20 rounded p-3 mt-4">
              <div className="text-xs text-emerald-300 font-medium mb-2">🏆 Best Performers (Fastest to Target):</div>
              {analysis.bestPerformers.map((s, idx) => (
                <div key={s.id} className="text-xs text-slate-300 py-1">
                  {idx + 1}. <span className="font-semibold text-emerald-400">{s.symbol}</span> - 
                  Target in {s.backtest?.timeToTarget || 0} min
                  {s.finalRank && <span className="text-yellow-400"> (AI Rank #{s.finalRank})</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: What Failed */}
        <div className="bg-slate-900/40 rounded-lg p-5 border border-red-900/30">
          <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ❌ What Failed Today
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Average Gap % (Losers)</span>
              <span className="font-bold text-red-400">{analysis.avgGapLosers >= 0 ? '+' : ''}{analysis.avgGapLosers.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Avg RS 20D (Losers)</span>
              <span className="font-bold text-red-400">+{analysis.avgRSLosers.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Avg Vol Surge (Losers)</span>
              <span className="font-bold text-red-400">{analysis.avgVolSurgeLosers.toFixed(0)}%</span>
            </div>
            {analysis.worstPerformers.length > 0 && (
              <div className="bg-red-900/20 rounded p-3 mt-4">
                <div className="text-xs text-red-300 font-medium mb-2">⚠️ Stocks That Hit SL:</div>
                {analysis.worstPerformers.map((s, idx) => (
                  <div key={s.id} className="text-xs text-slate-300 py-1">
                    {idx + 1}. <span className="font-semibold text-red-400">{s.symbol}</span> - 
                    SL in {s.backtest?.timeToSL || 0} min
                    {s.finalRank && <span className="text-yellow-400"> (AI Rank #{s.finalRank})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tomorrow's Action Plan */}
      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-lg p-6 border border-indigo-700/50">
        <h3 className="text-lg font-bold text-indigo-300 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          🎯 Tomorrow's Strategy (Based on Today's Results)
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Key Learnings */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">📚 Key Learnings:</h4>
            
            {parseFloat(analysis.top5WinRate) > parseFloat(analysis.overallWinRate) ? (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span className="text-slate-300">
                  <strong className="text-emerald-400">AI consensus works!</strong> Top 5 outperformed 
                  ({analysis.top5WinRate}% vs {analysis.overallWinRate}% overall)
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-yellow-400 mt-0.5">⚠</span>
                <span className="text-slate-300">
                  AI picks didn't outperform today. Trust your score metric.
                </span>
              </div>
            )}
            
            {analysis.avgGapWinners > analysis.avgGapLosers + 0.5 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span className="text-slate-300">
                  <strong className="text-cyan-400">Larger gaps win:</strong> Winners averaged 
                  +{analysis.avgGapWinners.toFixed(2)}% gap vs +{analysis.avgGapLosers.toFixed(2)}% for losers
                </span>
              </div>
            )}
            
            {analysis.avgRSWinners > analysis.avgRSLosers + 1 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span className="text-slate-300">
                  <strong className="text-cyan-400">Relative strength matters:</strong> Winners had 
                  +{analysis.avgRSWinners.toFixed(1)} RS vs +{analysis.avgRSLosers.toFixed(1)} for losers
                </span>
              </div>
            )}
            
            {parseFloat(analysis.strongUptrendWinRate) > 60 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span className="text-slate-300">
                  <strong className="text-cyan-400">Trend matters:</strong> Strong Uptrend stocks had 
                  {analysis.strongUptrendWinRate}% win rate
                </span>
              </div>
            )}
          </div>

          {/* Tomorrow's Filters */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2">🎯 Tomorrow's Filters:</h4>
            
            <div className="bg-slate-900/60 rounded p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="6"/>
                </svg>
                <span className="text-slate-200">
                  Gap% <strong className="text-emerald-400">&gt; {Math.max(1, analysis.avgGapWinners - 0.5).toFixed(1)}%</strong>
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="6"/>
                </svg>
                <span className="text-slate-200">
                  Relative Strength <strong className="text-emerald-400">&gt; +{Math.max(3, analysis.avgRSWinners - 1).toFixed(1)}</strong>
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="6"/>
                </svg>
                <span className="text-slate-200">
                  Trend Status: <strong className="text-emerald-400">Strong Uptrend</strong> 📈
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="6"/>
                </svg>
                <span className="text-slate-200">
                  Get <strong className="text-yellow-400">AI consensus</strong> from 3 sources ⭐
                </span>
              </div>
              
              {parseFloat(analysis.top5WinRate) > parseFloat(analysis.overallWinRate) && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <span className="text-slate-200 font-semibold">
                    <strong className="text-yellow-400">Only trade AI Top 5</strong> (Better win rate!)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Items */}
      <div className="bg-slate-900/60 rounded-lg p-5 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Tomorrow Morning Checklist:
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 font-bold">1.</span>
            <span className="text-slate-300">Upload pre-market CSV by 8:30 AM</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 font-bold">2.</span>
            <span className="text-slate-300">Filter for Gap% &gt; {Math.max(1, analysis.avgGapWinners - 0.5).toFixed(1)}%</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 font-bold">3.</span>
            <span className="text-slate-300">Check Strong Uptrend 📈 in indicators</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 font-bold">4.</span>
            <span className="text-slate-300">Get AI rankings from ChatGPT, Perplexity, DeepSeek</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 font-bold">5.</span>
            <span className="text-slate-300">Enter rankings & save before 9:15 AM</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 font-bold">6.</span>
            <span className="text-slate-300">
              {parseFloat(analysis.top5WinRate) > parseFloat(analysis.overallWinRate)
                ? 'Trade ONLY AI Top 5 ⭐'
                : 'Review all high-score signals'}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      {parseFloat(analysis.aiWinRate) > 0 && (
        <div className="bg-slate-900/40 rounded-lg p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 AI vs Score Performance:</h3>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">AI Top 5 Win Rate</span>
                <span className="font-bold text-yellow-400">{analysis.top5WinRate}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full"
                  style={{ width: `${analysis.top5WinRate}%` }}
                ></div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Overall Win Rate</span>
                <span className="font-bold text-slate-300">{analysis.overallWinRate}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-slate-600 to-slate-400 rounded-full"
                  style={{ width: `${analysis.overallWinRate}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-center">
            {parseFloat(analysis.top5WinRate) > parseFloat(analysis.overallWinRate) + 10 ? (
              <span className="text-emerald-400">🎉 AI consensus significantly outperformed! Use it tomorrow.</span>
            ) : parseFloat(analysis.top5WinRate) > parseFloat(analysis.overallWinRate) ? (
              <span className="text-yellow-400">✅ AI consensus slightly better. Keep using it.</span>
            ) : (
              <span className="text-slate-400">⚠️ AI consensus didn't help today. Focus on high Score instead.</span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Summary */}
      <div className="bg-indigo-900/20 rounded-lg p-4 border border-indigo-700/40">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-indigo-200">
            <strong>Bottom Line:</strong> {
              parseFloat(analysis.top5WinRate) >= 70 
                ? '🔥 AI Top 5 had excellent win rate. Repeat this process tomorrow!'
                : parseFloat(analysis.top5WinRate) >= 50
                ? '✅ AI Top 5 had good win rate. Continue using AI consensus.'
                : parseFloat(analysis.overallWinRate) >= 50
                ? '⚠️ Overall strategy works, but AI selection needs refinement.'
                : '❌ Review your strategy parameters. Consider adjusting entry/target levels.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}

