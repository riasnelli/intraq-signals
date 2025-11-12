# 🔧 Backtest Determinism Fix

## Problem
Every time you clicked "Backtest", the results kept changing - win rates, hit times, everything was different. This made the backtest unreliable and confusing.

## Root Cause
The mock intraday data generator was using `Math.random()` to simulate price movements. Since `Math.random()` produces different numbers each time, the same signal would produce different backtest results on every run.

```javascript
// OLD CODE (Non-deterministic)
const change = (Math.random() - 0.48) * currentPrice * 0.02;
```

## Solution

### 1. **Implemented Seeded Random Number Generator**
Created a deterministic random number generator that produces the same "random" sequence for the same input:

```javascript
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}
```

### 2. **Hash Function for Seed Generation**
Created a hash function that converts `date + symbol` into a unique number seed:

```javascript
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

### 3. **Deterministic Data Generation**
Now generates the same intraday data for the same date + symbol combination:

```javascript
// NEW CODE (Deterministic)
const seedBase = hashString(`${date}-${symbol}`);
const random1 = seededRandom(seedBase + seedCounter++);
const change = (random1 - 0.48) * currentPrice * 0.02;
```

### 4. **Prevent Unnecessary Re-runs**
Added confirmation dialog when trying to backtest signals that already have results:

```
Backtest data already exists for this batch.

Note: Results are deterministic and won't change.

Do you want to re-run anyway?
```

### 5. **Visual Indicators**
- Button changes from "🎯 Backtest" to "✅ Backtested" when data exists
- Color changes from purple to green
- Success message clarifies results are deterministic

## How It Works Now

### Example Scenario:
**Signal:** RELIANCE on 2025-11-12, Entry: 2850

**First Run:**
- Seed = hash("2025-11-12-RELIANCE") = 1234567890
- Generates deterministic price sequence
- Entry Hit: 9:30 AM
- Target Hit: 10:15 AM
- Result: WIN

**Second Run (same signal):**
- Seed = hash("2025-11-12-RELIANCE") = 1234567890 (same!)
- Generates SAME price sequence
- Entry Hit: 9:30 AM (same!)
- Target Hit: 10:15 AM (same!)
- Result: WIN (same!)

## Benefits

✅ **Consistent Results** - Same signal always produces same backtest  
✅ **Reproducible** - Can verify and audit results  
✅ **Reliable Analytics** - Insights are stable and meaningful  
✅ **Performance** - Prevents unnecessary re-computation  
✅ **User Confidence** - Results don't mysteriously change  

## Technical Details

### Seed Composition
```
Seed = hash(date + symbol)
Example: hash("2025-11-12-RELIANCE")
```

### Why Date + Symbol?
- **Date**: Different days should have different price patterns
- **Symbol**: Different stocks behave differently
- **Combined**: Ensures unique, reproducible data for each signal

### Deterministic Properties
- Same input → Same output (always)
- Different dates → Different patterns
- Different symbols → Different patterns
- Platform independent (works same on all devices)

## Future: Real API Integration

When you integrate the Dhan API with real historical OHLC data, replace:

```javascript
// Mock data
const intradayData = generateMockIntradayData(signal.date, signal.symbol, signal.entry);
```

With:

```javascript
// Real API data
const intradayData = await fetchDhanIntradayData(signal.date, signal.symbol);
```

The rest of the logic (checking entry/target/SL hits) will work exactly the same!

## Notes

- Mock data is still simulated (not real market data)
- When Dhan API is connected, results will be based on actual historical prices
- Determinism ensures consistency in testing and development phase
- Real API calls should cache data to avoid rate limits

