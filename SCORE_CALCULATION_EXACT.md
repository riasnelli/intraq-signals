# 📊 Exact Score Calculation Logic (0-10 Scale)

## 🎯 **Final Formula:**
```
Score = (Gap Score × 0.5) + (Proximity Score × 0.3) + (Liquidity Score × 0.2)
```

All components normalized to **0-10**, final result: **0-10**

---

## 📋 **Component 1: Gap Score (Weight 50%)**

### **What it measures:** 
Bullish price gap from previous close to pre-market IEP

### **Formula:**
```typescript
gapPct = ((IEP - prev_close) / prev_close) × 100

// Only positive gaps count (LONG strategy)
rawGap = Math.max(0, gapPct)

// Cap at 5% (anything above = full points)
cappedGap = clamp(rawGap, 0, 5)

// Normalize to 0-10
gapScore = (cappedGap / 5) × 10
```

### **Examples:**
```
Gap = 0.00% → 0 points
Gap = 0.50% → 1 point
Gap = 1.00% → 2 points
Gap = 2.50% → 5 points
Gap = 5.00% → 10 points (maximum)
Gap = 8.00% → 10 points (capped)
```

### **Real Example (TMPV):**
```
prev_close = 403.13
IEP = 404.00
gapPct = ((404 - 403.13) / 403.13) × 100 = 0.22%

rawGap = max(0, 0.22) = 0.22
cappedGap = clamp(0.22, 0, 5) = 0.22
gapScore = (0.22 / 5) × 10 = 0.44 points ✓
```

---

## 📋 **Component 2: Proximity Score (Weight 30%)**

### **What it measures:** 
How close the stock is to its 52-week high

### **Formula:**
```typescript
// Calculate distance from 52W high
if (nm_52w_h exists and > 0) {
  dist = Math.abs((IEP / nm_52w_h - 1) × 100)
} else {
  dist = 25  // Neutral assumption if missing
}

// Cap at 50% (anything beyond = 0 points)
cappedDist = clamp(dist, 0, 50)

// Invert: closer = higher score
proxScore = ((50 - cappedDist) / 50) × 10
```

### **Examples:**
```
At 52W high (0% away)     → 10 points (best!)
1% below high             → 9.8 points
5% below high             → 9.0 points
10% below high            → 8.0 points
25% below high            → 5.0 points (neutral)
40% below high            → 2.0 points
50%+ below high           → 0 points (worst)
Missing 52W high data     → 5.0 points (neutral)
```

### **Real Example (TMPV):**
```
IEP = 404.00
nm_52w_h = 415.00

dist = Math.abs((404 / 415 - 1) × 100) = 2.65%
cappedDist = clamp(2.65, 0, 50) = 2.65
proxScore = ((50 - 2.65) / 50) × 10 = 9.47 points ✓
```

### **Real Example (TMCV - Missing Data):**
```
IEP = 316.60
nm_52w_h = null (missing)

dist = 25  // Neutral assumption
proxScore = ((50 - 25) / 50) × 10 = 5.0 points ✓
```

---

## 📋 **Component 3: Liquidity Score (Weight 20%)**

### **What it measures:** 
Trading volume/turnover in rupees

### **Formula:**
```typescript
// Based on value_cr (₹ Crores) from CSV

if (value_cr >= 50) → HIGH → 10 points
else if (value_cr >= 10) → MEDIUM → 6 points
else → LOW → 2 points
```

### **Examples:**
```
Turnover 100 Cr → HIGH → 10 points
Turnover 50 Cr  → HIGH → 10 points
Turnover 30 Cr  → MEDIUM → 6 points
Turnover 10 Cr  → MEDIUM → 6 points
Turnover 5 Cr   → LOW → 2 points
Missing data    → LOW → 2 points
```

### **Real Example (TMPV):**
```
value_cr = 25 Crores

if (25 >= 50) → no
else if (25 >= 10) → yes → MEDIUM
liqScore = 6 points ✓
```

---

## 🎯 **Complete Calculation Examples:**

### **Example 1: TMPV (Moderate Score)**
```
CSV Input:
- prev_close: 403.13
- IEP: 404.00  
- nm_52w_h: 415.00
- value_cr: 25 Crores

Step 1: Gap Score
  gapPct = 0.22%
  gapScore = (0.22 / 5) × 10 = 0.44 points

Step 2: Proximity Score
  dist = 2.65%
  proxScore = ((50 - 2.65) / 50) × 10 = 9.47 points

Step 3: Liquidity Score
  25 Cr → MEDIUM → 6 points

Final Score:
  = (0.44 × 0.5) + (9.47 × 0.3) + (6 × 0.2)
  = 0.22 + 2.84 + 1.20
  = 4.26 / 10 ✓
```

### **Example 2: TRENT (Small Gap, Near High, High Liquidity)**
```
CSV Input:
- prev_close: 4376.00
- IEP: 4378.00
- nm_52w_h: 4500.00
- value_cr: 85 Crores

Step 1: Gap Score
  gapPct = 0.05%
  gapScore = (0.05 / 5) × 10 = 0.10 points

Step 2: Proximity Score
  dist = 2.71%
  proxScore = ((50 - 2.71) / 50) × 10 = 9.46 points

Step 3: Liquidity Score
  85 Cr → HIGH → 10 points

Final Score:
  = (0.10 × 0.5) + (9.46 × 0.3) + (10 × 0.2)
  = 0.05 + 2.84 + 2.00
  = 4.89 / 10 ✓
```

### **Example 3: TATASTEEL (Large Gap)**
```
CSV Input:
- prev_close: 178.57
- IEP: 184.00
- nm_52w_h: 200.00
- value_cr: 45 Crores

Step 1: Gap Score
  gapPct = 3.04%
  gapScore = (3.04 / 5) × 10 = 6.08 points

Step 2: Proximity Score
  dist = 8.00%
  proxScore = ((50 - 8.00) / 50) × 10 = 8.40 points

Step 3: Liquidity Score
  45 Cr → MEDIUM → 6 points

Final Score:
  = (6.08 × 0.5) + (8.40 × 0.3) + (6 × 0.2)
  = 3.04 + 2.52 + 1.20
  = 6.76 / 10 ✓
```

### **Example 4: TMCV (Gap-Down, Missing 52W High) - The Bug Case**
```
CSV Input:
- prev_close: 329.00
- IEP: 316.60
- nm_52w_h: null (missing)
- value_cr: 35 Crores

Step 1: Gap Score
  gapPct = -3.77% (gap-down)
  rawGap = max(0, -3.77) = 0  // Negative gaps = 0 for LONG
  gapScore = 0 points

Step 2: Proximity Score (Missing Data)
  dist = 25 (neutral assumption)
  proxScore = ((50 - 25) / 50) × 10 = 5.0 points

Step 3: Liquidity Score
  35 Cr → MEDIUM → 6 points

Final Score:
  = (0 × 0.5) + (5.0 × 0.3) + (6 × 0.2)
  = 0 + 1.50 + 1.20
  = 2.70 / 10 ✓

Old Score: 197.46 ✗ (BUG!)
New Score: 2.70 ✓ (FIXED!)
```

---

## 📊 **Score Ranges & Interpretation:**

| Score | Quality | What It Means | Action |
|-------|---------|---------------|--------|
| **8.0-10.0** | 🔥 Exceptional | Large gap (3-5%+) + Very close to 52W high (0-5% below) + High liquidity | **Strong Buy** - Best candidates |
| **6.0-8.0** | ⭐ Excellent | Good gap (2-3%) OR very near high + Good liquidity | **Buy** - High probability |
| **4.0-6.0** | ✅ Good | Moderate gap (0.5-2%) + Decent proximity + Average liquidity | **Selective Buy** - Worth trading |
| **2.0-4.0** | 🟡 Weak | Small gap (<1%) OR far from high + Low liquidity | **Cautious** - High risk |
| **0.0-2.0** | ❌ Very Weak | No gap/gap-down + Far from high OR very low liquidity | **Avoid** - Poor setup |

---

## 🎯 **What Makes a Perfect 10/10?**

```
Theoretical Perfect Score:

Gap:      5.0%+ (capped) → 10 points × 0.5 = 5.0
Proximity: 0% (at high) → 10 points × 0.3 = 3.0  
Liquidity: 50+ Crores   → 10 points × 0.2 = 2.0
                                    Total = 10.0

Example Perfect Candidate:
- Stock gaps up 5% in pre-market
- Trading exactly at its 52-week high  
- 100 Crore daily turnover
→ Score = 10.0 / 10 🏆
```

---

## 🔄 **Typical Score Distribution:**

For a batch of 25 momentum signals:
```
Scores 7-10:  Top 2-3 stocks (exceptional setups)
Scores 5-7:   Next 5-8 stocks (solid trades)
Scores 3-5:   Next 8-10 stocks (moderate quality)
Scores 1-3:   Remaining stocks (weak signals)
```

---

## 💡 **Why These Weights?**

### **Gap (50%):**
- Most important for intraday momentum
- Shows immediate market sentiment
- Directly predicts follow-through

### **Proximity (30%):**
- Second most important
- Stocks near 52W high have strong momentum
- Higher breakout probability

### **Liquidity (20%):**
- Ensures tradability
- Lower weight because even medium liquidity is tradable
- Prevents illiquid stocks from dominating

---

## 🚀 **Action Required:**

### **1. Refresh Browser**
```bash
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

### **2. Re-Upload Your CSV**
- Upload Nov 13 pre-market CSV again
- Click "Run" to generate signals
- **New scores will be calculated!**

### **3. Check Results**
```
Expected changes:
- TMCV: 197.46 → ~2.70 (FIXED!)
- TMPV: 10.43 → ~4.26
- All scores: 0-10 range
- Properly sorted by quality
```

### **4. Save Signals**
- Technical indicators will also calculate
- All data stored in database

---

## 📊 **Quick Reference Card:**

```
┌─────────────────────────────────────────────────┐
│ MOMENTUM SCORE CALCULATION (0-10)              │
├─────────────────────────────────────────────────┤
│ Gap Score (0-10) × 0.5                         │
│   • 0% gap = 0 pts                             │
│   • 5%+ gap = 10 pts                           │
│   • Negative gaps = 0 pts (LONG only)          │
├─────────────────────────────────────────────────┤
│ Proximity Score (0-10) × 0.3                   │
│   • At 52W high = 10 pts                       │
│   • 50% below = 0 pts                          │
│   • Missing data = 5 pts (neutral)             │
├─────────────────────────────────────────────────┤
│ Liquidity Score (0-10) × 0.2                   │
│   • HIGH (50+ Cr) = 10 pts                     │
│   • MEDIUM (10-50 Cr) = 6 pts                  │
│   • LOW (<10 Cr) = 2 pts                       │
└─────────────────────────────────────────────────┘
```

---

## ✅ **Committed & Pushed to GitHub!**

The exact calculation is now running in your app. Re-upload your CSV to see the corrected scores!

