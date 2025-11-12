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

  // Try to fetch real data from Dhan API
  if (dhanApi.isConfigured()) {
    try {
      console.log(`🔍 Attempting to fetch real data for ${signal.symbol} on ${signal.date}`);
      
      const realData = await dhanApi.fetchIntradayData(signal.symbol, signal.date);
      
      if (realData && realData.length > 0) {
        intradayData = realData;
        usedRealData = true;
        console.log(`✅ Using REAL DATA: ${realData.length} data points for ${signal.symbol}`);
      } else {
        throw new Error('No data received from Dhan API');
      }
    } catch (error: any) {
      console.warn(`⚠️ Dhan API failed for ${signal.symbol}: ${error.message}`);
      console.log(`🎭 Falling back to mock data for ${signal.symbol}`);
      // Fallback to mock data
      intradayData = generateMockIntradayData(signal.date, signal.symbol, signal.entry);
      usedRealData = false;
    }
  } else {
    console.log(`🎭 Dhan API not configured, using mock data for ${signal.symbol}`);
    // Use mock data if API not configured
    intradayData = generateMockIntradayData(signal.date, signal.symbol, signal.entry);
    usedRealData = false;
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
      usedRealData
    }
  };
}

// Backtest multiple signals
export async function backtestBatch(signals: TSignal[]): Promise<TSignal[]> {
  const results: TSignal[] = [];
  
  for (const signal of signals) {
    // Add sector if missing
    const signalWithSector = {
      ...signal,
      sector: signal.sector ?? sectorMap[signal.symbol] ?? "UNKNOWN"
    };
    
    const backtested = await backtestSignal(signalWithSector);
    results.push(backtested);
    
    // Update in database
    if (signal.id) {
      await db.signals.update(signal.id, { 
        sector: backtested.sector,
        backtest: backtested.backtest 
      });
    }
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