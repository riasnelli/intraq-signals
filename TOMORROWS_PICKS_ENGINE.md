# Tomorrow's Picks Engine - MQScore System

## 📊 **Overview**

The **Tomorrow's Picks Engine** is an AI-like scoring system that analyzes your signals and automatically generates the **Top 5 best setups for tomorrow's trading**. It goes beyond simple score sorting by combining multiple technical factors into a **Momentum Quality Score (MQScore)**.

---

## 🎯 **What is MQScore?**

**MQScore** is a composite score (0–10) that evaluates the quality of a momentum setup by analyzing:

1. **Gap % (25% weight)** - Size of bullish gap (0–4% mapped to 0–10)
2. **RS 20D (25% weight)** - Relative Strength (-2 to +8 mapped to 0–10)
3. **Trend Status (20% weight)** - Strong Uptrend=10, Weak Uptrend=7, Consolidation=5, Downtrend=0
4. **Near High (20% weight)** - Proximity to 52W or Day High (Yes=10, No=0)
5. **VWAP Distance (10% weight)** - Trading above VWAP (0–1.5% mapped to 0–10)

### **Formula:**

```
MQScore = (gapScore × 0.25) + (rsScore × 0.25) + (trendScore × 0.20) + (nearHighScore × 0.20) + (vwapScore × 0.10)
```

### **Why MQScore is Better Than Raw Score:**

- **Your base score** measures general momentum strength
- **MQScore** evaluates **setup quality** for the next day
- It filters out "yesterday's winners" that may have exhausted their move
- It prioritizes **fresh, confirmed breakouts** with strong technicals

---

## 🔍 **How It Works**

### **Step 1: Calculate MQScore**

For every signal in your base table, the engine calculates an MQScore.

### **Step 2: Apply Tomorrow's Filters**

Only signals that meet **all** these criteria are considered:

| Filter | Default Threshold |
|--------|-------------------|
| Side | LONG only |
| Gap% | ≥ 1.0% |
| RS 20D | ≥ 3.0 |
| Base Score | ≥ 3.0 |
| Trend Status | Strong Uptrend OR Weak Uptrend |
| VWAP Distance | ≥ 0% (trading above VWAP) |

### **Step 3: Sort by MQScore**

Remaining candidates are sorted by:
1. **MQScore** (primary)
2. **Base Score** (tiebreaker)
3. **RS 20D** (tiebreaker)

### **Step 4: Select Top 5**

The top 5 signals become **Tomorrow's Picks**.

---

## ⚠️ **Avoid List Generation**

The engine also generates an **Avoid List** for stocks that should be skipped tomorrow:

| Reason | Logic |
|--------|-------|
| **SL Hit Today** | If backtest shows stop loss was hit |
| **Weak RS20D** | RS 20D < 0 (underperforming market) |
| **Downtrend** | Trend Status = "Downtrend" |

---

## 📊 **Market Regime Detection**

The engine analyzes the overall market conditions:

### **Volatility Regime:**
- **LOW** - Avg ATR < 10
- **MEDIUM** - Avg ATR 10–50
- **HIGH** - Avg ATR > 50

### **Trend Bias:**
- **BULLISH** - Uptrend stocks > 1.5× Downtrend stocks
- **BEARISH** - Downtrend stocks > 1.5× Uptrend stocks
- **MIXED** - Balanced distribution

### **Strategy Recommendations:**

| Regime | Recommendation |
|--------|----------------|
| HIGH Volatility | Use wider stops, smaller positions |
| LOW Volatility | Avoid scalping, let winners run |
| BULLISH Bias | Favor LONGs, breakouts, dips |
| BEARISH Bias | Cautious with LONGs, wait for confirmation |
| MIXED | Be selective, only clear setups |

---

## 🎯 **Using Tomorrow's Picks**

### **Morning Routine:**

1. **Upload Pre-Market CSV** (by 8:30 AM)
2. **Generate Signals** (run your momentum strategy)
3. **View Tomorrow's Picks** (click "Tomorrow's Picks" button)
4. **Review Top 5** - Focus on MQScore > 6.0
5. **Check Avoid List** - Skip these symbols
6. **Set Price Alerts** for Top 5 entry levels
7. **Trade 9:15 AM onwards** - Wait for entry confirmation

### **Risk Management:**

- **Max 2-3% risk per trade**
- **Max 10% total portfolio exposure**
- **Adjust stops based on volatility regime**:
  - HIGH Volatility → 1.5% stop (wider)
  - MEDIUM Volatility → 1.2% stop (standard)
  - LOW Volatility → 1.0% stop (tighter)

---

## 🔧 **Customization**

You can adjust the filters in `src/logic/useTomorrowsPicks.ts`:

```typescript
return generateTomorrowsPicks(rows, {
  minGapPct: 1.0,    // Minimum gap %
  minRs20d: 3.0,     // Minimum relative strength
  minScore: 3.0,     // Minimum base score
});
```

### **Aggressive Settings (More Picks):**
```typescript
minGapPct: 0.5,
minRs20d: 2.0,
minScore: 2.5,
```

### **Conservative Settings (Fewer, Higher Quality):**
```typescript
minGapPct: 2.0,
minRs20d: 4.0,
minScore: 4.0,
```

---

## 📈 **Example Output**

### **Top 5 Picks:**

| Rank | Symbol | MQScore | Base Score | Gap% | RS20D | Trend | VWAP% |
|------|--------|---------|------------|------|-------|-------|-------|
| 1 | TITAN | 8.42 | 8.1 | 2.3% | 5.2 | Strong Uptrend | +0.8% |
| 2 | RELIANCE | 7.89 | 7.5 | 1.8% | 4.8 | Strong Uptrend | +1.2% |
| 3 | TATASTEEL | 7.56 | 7.2 | 2.1% | 4.2 | Weak Uptrend | +0.5% |
| 4 | TCS | 7.23 | 6.9 | 1.5% | 4.5 | Strong Uptrend | +0.3% |
| 5 | JSWSTEEL | 7.01 | 6.8 | 1.9% | 3.9 | Weak Uptrend | +0.4% |

### **Avoid List:**

| Symbol | Reason |
|--------|--------|
| HINDALCO | SL Hit Today (9:42 AM) |
| BHARTIARTL | Weak RS20D (-1.2) |
| NESTLEIND | Downtrend |

### **Market Regime:**

- **Volatility:** MEDIUM
- **Trend Bias:** BULLISH
- **Note:** "Bullish bias: favour LONG breakouts / buy-the-dip setups."

---

## ✅ **Benefits**

1. **Objective Selection** - No emotional bias
2. **Multi-Factor Analysis** - Not just score-based
3. **Market-Aware** - Adapts to regime
4. **Risk Management** - Built-in avoid list
5. **Time-Saving** - Auto-generates picks in seconds
6. **Backtestable** - Logic can be validated

---

## 🚀 **Next Steps**

1. **Refresh your browser** (Cmd+Shift+R)
2. **Go to History** → Open your latest batch
3. **Click "Tomorrow's Picks"** button
4. **Review Top 5 + Avoid List**
5. **Trade tomorrow based on these insights!**

---

## 📝 **Technical Details**

- **Location:** `src/logic/tomorrowsPicks.ts`
- **Hook:** `src/logic/useTomorrowsPicks.ts`
- **UI Component:** `src/components/TomorrowPicks.tsx`
- **Pure TypeScript** - No external dependencies
- **Memoized** - Only recalculates when signals change
- **Type-Safe** - Full TypeScript support

---

## 🎉 **Summary**

The **Tomorrow's Picks Engine** is a production-ready, AI-like system that:

✅ **Automatically selects your best setups**  
✅ **Filters out risky trades**  
✅ **Adapts to market conditions**  
✅ **Provides actionable insights**  
✅ **Works with your existing data**  

**No API calls. No subscriptions. Just smart logic.**

---

**Happy Trading! 🚀**

