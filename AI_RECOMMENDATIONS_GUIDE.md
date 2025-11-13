# 🤖 AI Recommendations & Backtest Timing Guide

## ✨ New Features Implemented

### 1. **AI Recommendation Columns**
Added 4 new columns to track AI recommendations:

| Column | Color | Purpose |
|--------|-------|---------|
| **GPT** | Blue | ChatGPT ranking (1-5) |
| **Perp** | Purple | Perplexity ranking (1-5) |
| **Deep** | Green | DeepSeek ranking (1-5) |
| **Final** | Yellow | Consolidated ranking |

### 2. **Score-Based Sorting**
- Signals are now **sorted by score** (highest first)
- Top scores appear at the top of the table
- Makes it easy to identify high-confidence signals

### 3. **Backtest Time Restriction**
- Backtest button **only enabled after 4:00 PM IST**
- Before 4 PM: Shows "Backtest (After 4 PM)" in gray
- After 4 PM: Shows normal "Backtest" button
- Prevents incomplete backtests during market hours

### 4. **Wider Table (95% Page Width)**
- Table expands to 95% of viewport width
- More room for all the new columns
- Horizontal scrolling if needed

### 5. **Top 5 Highlighting**
- Stocks with `finalRank ≤ 5` get:
  - Yellow background highlight
  - Star emoji (⭐) next to symbol
  - Border accent on the left

---

## 📋 Your Workflow

### **Morning (Before Market - 8:00 AM)**
```
1. Get NSE pre-market data
2. Generate 22 signals in your system
3. Export to CSV
4. Upload to this app
```

### **Manual AI Ranking (8:00 AM - 9:00 AM)**
```
5. Export/Copy the signals table
6. Ask ChatGPT: "Which are the top 5 stocks to trade?"
   → Enter their rankings (1-5) in the "GPT" column
   
7. Ask Perplexity: "Rank these 5 stocks for intraday trading"
   → Enter their rankings (1-5) in the "Perp" column
   
8. Ask DeepSeek: "Select top 5 from this list"
   → Enter their rankings (1-5) in the "Deep" column
```

### **Automatic Final Ranking**
```
9. As you enter AI rankings, "Final" column auto-calculates
   → Average of all 3 AI rankings
   → Lower number = better rank
   → Top 5 get highlighted with ⭐ and yellow background
```

### **After Market Close (After 4:00 PM)**
```
10. Click "Backtest" button (now enabled)
11. Wait for results (1 second per stock)
12. See which stocks hit entry, target, or SL
13. Compare AI predictions vs actual results
14. Refine your strategy for tomorrow
```

---

## 🎯 How AI Rankings Work

### **Example Scenario:**
Stock: **TRENT**
- ChatGPT ranks it #2
- Perplexity ranks it #1
- DeepSeek ranks it #3

**Final Rank = (2 + 1 + 3) / 3 = 2.0**

### **Top 5 Selection:**
All stocks with `finalRank ≤ 5` are considered "Top 5"
- Rank 1: 🥇 Gold highlight + star
- Rank 2-5: Yellow highlight + star
- Rank 6+: Normal appearance

---

## 🔧 Technical Details

### **Database Schema Updated:**
```typescript
TSignal {
  chatGptRank?: number;      // 1-5
  perplexityRank?: number;   // 1-5
  deepSeekRank?: number;     // 1-5
  finalRank?: number;        // Auto-calculated average
}
```

### **Backtest Time Check:**
```typescript
// Past dates: Always allowed
// Today before 4 PM: Blocked with message
// Today after 4 PM: Allowed
// Future dates: Blocked
```

### **Sorting Logic:**
```typescript
signals.sort((a, b) => (b.score || 0) - (a.score || 0))
// Highest score first
```

---

## 💡 Tips for Best Results

### **1. AI Prompt Template:**
```
I have 22 LONG signals for NSE stocks based on momentum strategy.
Each has an entry, target, stop loss, and technical score (0-10).

Here are the top 10 by score:
[Paste top 10 rows from table]

Please analyze and rank your top 5 stocks (1=best, 5=okay) 
considering:
- Technical score
- Gap-up momentum
- Risk:Reward (all are 1:2.1)
- Market conditions

Return format: Symbol - Rank
```

### **2. Why Use 3 Different AIs?**
- **Diversification**: Each AI has different training data
- **Consensus**: Average ranking reduces bias
- **Validation**: If all 3 agree on a stock, it's stronger

### **3. Comparing Predictions vs Results:**
After backtest, check:
- Did top-ranked stocks actually hit targets?
- Which AI was most accurate?
- Adjust your strategy based on patterns

---

## 🚀 Quick Start (Next Steps)

1. **Refresh your browser** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. **Open your Nov 13 signals** (currently visible in your screenshot)
3. **Try entering some rankings:**
   - Click on "GPT" column for WIPRO, enter `3`
   - Click on "Perp" column for WIPRO, enter `2`
   - Click on "Deep" column for WIPRO, enter `1`
   - Watch "Final" column auto-update to `2.0`
4. **Check the backtest button:**
   - If before 4 PM: Shows "Backtest (After 4 PM)" in gray
   - If after 4 PM: Shows "Backtest" in purple (clickable)

---

## 📊 Data Sources Legend

| Indicator | Meaning |
|-----------|---------|
| ⓨ | Data from Yahoo Finance (Dhan API failed) |
| ⭐ | AI Top 5 recommendation |
| Yellow row | Top 5 ranked stock |
| Darker row | Yahoo Finance data |
| Dim row | No data available |

---

## ❓ FAQ

**Q: Can I change rankings after entering them?**
A: Yes! Just type a new number (1-5) in any AI column. Final rank updates automatically.

**Q: What if I only use 1 or 2 AIs?**
A: That's fine! Final rank calculates average of whatever you enter.

**Q: Can I backtest before 4 PM if market is closed?**
A: No. The system uses the date of your signals, not current market status. It always waits until 4 PM on the signal date to ensure complete data availability.

**Q: Why is the table so wide now?**
A: To fit all the new AI ranking columns. You can scroll horizontally if needed, or use a larger screen.

**Q: Do AI rankings affect backtest results?**
A: No. Backtest uses actual market data. AI rankings are for pre-trade decision-making only.

---

## 🎉 Summary

You now have a complete **AI-assisted trading workflow**:
1. ✅ Pre-market signal generation
2. ✅ AI consensus ranking (ChatGPT + Perplexity + DeepSeek)
3. ✅ Automatic Top 5 selection
4. ✅ Time-gated backtesting (after 4 PM only)
5. ✅ Visual highlighting of top picks
6. ✅ Score-based sorting
7. ✅ 95% wide table for all data

**Next:** Refresh browser, enter your AI rankings, wait till 4 PM, then backtest!

