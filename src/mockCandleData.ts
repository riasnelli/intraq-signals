// mockCandleData.ts
// Generate realistic mock candle data for indicator calculations

import { Candle } from './signalMetrics';

// Generate 60 days of mock candles based on current price
export function generateMockCandles(
  symbol: string,
  currentPrice: number,
  days = 60
): Candle[] {
  const candles: Candle[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);

  // Use symbol hash for consistent randomness per symbol
  const seed = hashString(symbol);
  let price = currentPrice * 0.85; // Start 15% lower for trend simulation
  
  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    // Deterministic random based on symbol + day
    const dayRandom = seededRandom(seed + i);
    const dayRandom2 = seededRandom(seed + i + 1000);
    const dayRandom3 = seededRandom(seed + i + 2000);
    const dayRandom4 = seededRandom(seed + i + 3000);
    
    // Add slight upward trend (to reach current price)
    const trendDrift = currentPrice * 0.15 / days; // 15% total gain over 60 days
    
    // Daily volatility (0.5% to 2%)
    const volatility = 0.005 + dayRandom * 0.015;
    const change = (dayRandom2 - 0.5) * volatility * price + trendDrift;
    
    const open = price;
    const close = price + change;
    
    // Intraday high/low
    const highMove = Math.abs(dayRandom3) * volatility * price;
    const lowMove = Math.abs(dayRandom4) * volatility * price;
    
    const high = Math.max(open, close) + highMove;
    const low = Math.min(open, close) - lowMove;
    
    // Volume (mock)
    const baseVolume = 1000000;
    const volume = Math.floor(baseVolume * (0.5 + dayRandom * 1.5));
    
    candles.push({
      time: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume
    });
    
    price = close; // Next day starts at previous close
  }
  
  return candles;
}

// Generate mock Nifty50 index candles
export function generateNiftyCandles(days = 60): Candle[] {
  const candles: Candle[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);
  
  let price = 23500; // Starting Nifty level
  
  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    const dayRandom = seededRandom(12345 + i);
    const dayRandom2 = seededRandom(12345 + i + 1000);
    const dayRandom3 = seededRandom(12345 + i + 2000);
    const dayRandom4 = seededRandom(12345 + i + 3000);
    
    // Index is less volatile (0.3% to 1%)
    const volatility = 0.003 + dayRandom * 0.007;
    const change = (dayRandom2 - 0.5) * volatility * price;
    
    const open = price;
    const close = price + change;
    
    const highMove = Math.abs(dayRandom3) * volatility * price * 0.5;
    const lowMove = Math.abs(dayRandom4) * volatility * price * 0.5;
    
    const high = Math.max(open, close) + highMove;
    const low = Math.min(open, close) - lowMove;
    
    candles.push({
      time: date.toISOString().split('T')[0],
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: 0 // Index doesn't have volume
    });
    
    price = close;
  }
  
  return candles;
}

// Seeded random function (same as backtest.ts)
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Hash string to number (same as backtest.ts)
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

