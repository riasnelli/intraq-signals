import { db, TBacktest, TSignal } from "./db";
import sectorMap from "./utils/sectorMap";
import { dhanApi } from "./services/dhanApi";

// Seeded random number generator for deterministic results
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Generate a seed from string (date + symbol)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Mock intraday data generator - simulates OHLC tick data (DETERMINISTIC)
function generateMockIntradayData(date: string, symbol: string, openPrice: number) {
  const data: Array<{ time: string; price: number; high: number; low: number }> = [];
  const startHour = 9;
  const startMinute = 15;
  const endHour = 15;
  const endMinute = 30;
  
  // Create deterministic seed based on date + symbol
  const seedBase = hashString(`${date}-${symbol}`);
  let seedCounter = 0;
  
  let currentPrice = openPrice;
  let currentHour = startHour;
  let currentMinute = startMinute;
  
  while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
    // Simulate price movement (deterministic random walk with slight upward bias)
    const random1 = seededRandom(seedBase + seedCounter++);
    const change = (random1 - 0.48) * currentPrice * 0.02; // ±2% movement
    currentPrice = currentPrice + change;
    
    const random2 = seededRandom(seedBase + seedCounter++);
    const random3 = seededRandom(seedBase + seedCounter++);
    const high = currentPrice * (1 + random2 * 0.01);
    const low = currentPrice * (1 - random3 * 0.01);
    
    const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    data.push({ time: timeStr, price: currentPrice, high, low });
    
    // Increment by 5 minutes
    currentMinute += 5;
    if (currentMinute >= 60) {
      currentMinute = 0;
      currentHour++;
    }
  }
  
  return data;
}

// Convert 24hr to 12hr format
function to12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Backtest a single signal
export async function backtestSignal(signal: TSignal): Promise<TSignal> {
  let intradayData: Array<{ time: string; price: number; high: number; low: number }>;
  let usedRealData = false;
  let dataSource: 'dhan' | 'yfinance' | undefined;

  // Fetch real data from Dhan API (with yfinance fallback on backend)
  if (!dhanApi.isConfigured()) {
    console.warn(`⚠️ Dhan API not configured, skipping ${signal.symbol}`);
    return {
      ...signal,
      backtest: {
        entryHit: false,
        targetHit: false,
        slHit: false,
        outcome: undefined,
        usedRealData: false,
        noData: true
      }
    };
  }
  
  try {
    console.log(`🔍 Fetching real data for ${signal.symbol} on ${signal.date}`);
    
    const response = await dhanApi.fetchIntradayData(signal.symbol, signal.date);
    
    if (response.data && response.data.length > 0) {
      intradayData = response.data;
      usedRealData = true;
      dataSource = response.dataSource;
      console.log(`✅ Using REAL DATA: ${response.data.length} data points for ${signal.symbol} (source: ${dataSource})`);
    } else {
      throw new Error('No data available');
    }
  } catch (error: any) {
    console.warn(`⚠️ No data available for ${signal.symbol}, skipping backtest`);
    return {
      ...signal,
      backtest: {
        entryHit: false,
        targetHit: false,
        slHit: false,
        outcome: undefined,
        usedRealData: false,
        noData: true
      }
    };
  }
  
  let entryHit = false;
  let entryHitTime: string | undefined;
  let targetHit = false;
  let targetHitTime: string | undefined;
  let slHit = false;
  let slHitTime: string | undefined;

  // Check each tick to see if prices were hit
  for (const tick of intradayData) {
    const { time, high, low } = tick;
    
    if (signal.side === 'LONG') {
      // For LONG positions
      if (!entryHit && low <= signal.entry) {
        entryHit = true;
        entryHitTime = to12Hour(time);
      }
      
      if (entryHit && !targetHit && high >= signal.target) {
        targetHit = true;
        targetHitTime = to12Hour(time);
      }
      
      if (entryHit && !slHit && low <= signal.stopLoss) {
        slHit = true;
        slHitTime = to12Hour(time);
      }
    } else {
      // For SHORT positions
      if (!entryHit && high >= signal.entry) {
        entryHit = true;
        entryHitTime = to12Hour(time);
      }
      
      if (entryHit && !targetHit && low <= signal.target) {
        targetHit = true;
        targetHitTime = to12Hour(time);
      }
      
      if (entryHit && !slHit && high >= signal.stopLoss) {
        slHit = true;
        slHitTime = to12Hour(time);
      }
    }
    
    // Stop if both target and SL are checked
    if ((targetHit || slHit) && entryHit) {
      break;
    }
  }

  // Calculate outcome and time metrics
  let outcome: "target" | "sl" | "no_trigger" = "no_trigger";
  let timeToTarget: number | undefined;
  let timeToSL: number | undefined;
  
  if (entryHit) {
    if (targetHit && slHit) {
      // Both hit - determine which came first
      const entryTime = intradayData.find(t => to12Hour(t.time) === entryHitTime)?.time || "09:15";
      const targetTime = intradayData.find(t => to12Hour(t.time) === targetHitTime)?.time || "15:30";
      const slTime = intradayData.find(t => to12Hour(t.time) === slHitTime)?.time || "15:30";
      
      const [eh, em] = entryTime.split(':').map(Number);
      const [th, tm] = targetTime.split(':').map(Number);
      const [sh, sm] = slTime.split(':').map(Number);
      
      const entryMins = eh * 60 + em;
      const targetMins = th * 60 + tm;
      const slMins = sh * 60 + sm;
      
      if (targetMins < slMins) {
        outcome = "target";
        timeToTarget = targetMins - entryMins;
      } else {
        outcome = "sl";
        timeToSL = slMins - entryMins;
      }
    } else if (targetHit) {
      outcome = "target";
      const entryTime = intradayData.find(t => to12Hour(t.time) === entryHitTime)?.time || "09:15";
      const targetTime = intradayData.find(t => to12Hour(t.time) === targetHitTime)?.time || "15:30";
      const [eh, em] = entryTime.split(':').map(Number);
      const [th, tm] = targetTime.split(':').map(Number);
      timeToTarget = (th * 60 + tm) - (eh * 60 + em);
    } else if (slHit) {
      outcome = "sl";
      const entryTime = intradayData.find(t => to12Hour(t.time) === entryHitTime)?.time || "09:15";
      const slTime = intradayData.find(t => to12Hour(t.time) === slHitTime)?.time || "15:30";
      const [eh, em] = entryTime.split(':').map(Number);
      const [sh, sm] = slTime.split(':').map(Number);
      timeToSL = (sh * 60 + sm) - (eh * 60 + em);
    }
  }

  return {
    ...signal,
    backtest: {
      entryHit,
      entryHitTime,
      targetHit,
      targetHitTime,
      slHit,
      slHitTime,
      outcome,
      timeToTarget,
      timeToSL,
      usedRealData,
      dataSource
    }
  };
}

// Helper function to add delay between API calls (avoid rate limiting)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate optimal delay based on Dhan API rate limits
// Dhan API allows ~2 requests per second (per their rate limit policy)
// To be safe, we use 1 request per 1 second = 1000ms delay
function calculateDhanDelay(signalCount: number): number {
  // Conservative approach: 1 request per second
  // This ensures we never hit the rate limit
  const DHAN_RATE_LIMIT_DELAY = 1000; // 1 second per request
  
  console.log(`⏱️ Using ${DHAN_RATE_LIMIT_DELAY}ms delay between requests to avoid rate limiting`);
  console.log(`⏱️ Estimated time: ~${Math.ceil(signalCount * DHAN_RATE_LIMIT_DELAY / 1000)} seconds for ${signalCount} stocks`);
  
  return DHAN_RATE_LIMIT_DELAY;
}

// Check if it's safe to backtest (market has closed)
function checkBacktestTiming(date: string): { canBacktest: boolean, message: string } {
  const signalDate = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  signalDate.setHours(0, 0, 0, 0);
  
  // If signal is from a past date, always safe
  if (signalDate < today) {
    return { canBacktest: true, message: 'Historical data available' };
  }
  
  // If signal is from today, check if market has closed
  if (signalDate.getTime() === today.getTime()) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const marketCloseTime = 15 * 60 + 30; // 3:30 PM = 15:30
    const dataAvailableTime = 16 * 60; // 4:00 PM = 16:00 (30 min after close)
    
    if (currentTimeMinutes < marketCloseTime) {
      return { 
        canBacktest: false, 
        message: `⚠️ Market is still open! Backtest after 4:00 PM IST for complete data.\nCurrent time: ${now.toLocaleTimeString('en-IN')}`
      };
    } else if (currentTimeMinutes < dataAvailableTime) {
      return { 
        canBacktest: true, 
        message: `⏳ Market just closed. Data might still be processing. If backtest fails, wait until 4:00 PM IST.`
      };
    } else {
      return { canBacktest: true, message: 'Today\'s complete data should be available' };
    }
  }
  
  // Future date
  return { 
    canBacktest: false, 
    message: `❌ Cannot backtest future date: ${date}. Signals must be from today or earlier.`
  };
}

// Backtest multiple signals with progress tracking
export async function backtestBatch(
  signals: TSignal[], 
  onProgress?: (current: number, total: number) => void
): Promise<TSignal[]> {
  // Check timing for the first signal (all signals in a batch are from the same date)
  if (signals.length > 0) {
    const timingCheck = checkBacktestTiming(signals[0].date);
    if (!timingCheck.canBacktest) {
      alert(timingCheck.message);
      throw new Error(timingCheck.message);
    } else if (timingCheck.message.includes('⏳')) {
      console.warn(timingCheck.message);
    } else {
      console.log(`✅ ${timingCheck.message}`);
    }
  }
  
  const results: TSignal[] = [];
  let noDataCount = 0;
  const delayMs = calculateDhanDelay(signals.length);
  
  console.log(`🔄 Backtesting ${signals.length} signals with Dhan API rate-limit protection...`);
  console.log(`⏱️ This will take approximately ${Math.ceil(signals.length * delayMs / 1000)} seconds`);
  
  for (let i = 0; i < signals.length; i++) {
    const signal = signals[i];
    
    // Report progress
    if (onProgress) {
      onProgress(i + 1, signals.length);
    }
    
    console.log(`[${i + 1}/${signals.length}] Processing ${signal.symbol}...`);
    
    // Add sector if missing
    const signalWithSector = {
      ...signal,
      sector: signal.sector ?? sectorMap[signal.symbol] ?? "UNKNOWN"
    };
    
    const backtested = await backtestSignal(signalWithSector);
    results.push(backtested);
    
    // Count stocks with no data
    if (backtested.backtest?.noData) {
      noDataCount++;
      console.log(`  ⚠️ No data available for ${signal.symbol}`);
    } else {
      console.log(`  ✅ ${signal.symbol} completed (source: ${backtested.backtest?.dataSource || 'unknown'})`);
    }
    
    // Update in database
    if (signal.id) {
      await db.signals.update(signal.id, { 
        sector: backtested.sector,
        backtest: backtested.backtest 
      });
    }
    
    // Add delay between requests to avoid Dhan API rate limiting
    // Skip delay for the last stock or if no data was available (no API call made)
    if (i < signals.length - 1 && !backtested.backtest?.noData) {
      console.log(`  ⏳ Waiting ${delayMs}ms before next request...`);
      await delay(delayMs);
    }
  }
  
  // Log summary
  const successCount = results.length - noDataCount;
  console.log(`\n✅ Backtest complete!`);
  console.log(`  📊 Success: ${successCount}/${results.length} stocks`);
  console.log(`  ⚠️ No data: ${noDataCount}/${results.length} stocks`);
  
  if (noDataCount > 0) {
    const noDataSymbols = results
      .filter(r => r.backtest?.noData)
      .map(r => r.symbol)
      .join(', ');
    console.warn(`  Stocks with no data: ${noDataSymbols}`);
  }
  
  return results;
}

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