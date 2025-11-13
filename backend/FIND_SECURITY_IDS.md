# 🔍 How to Find Dhan Security IDs

You have **25 stocks** that need Dhan Security IDs for backtesting to work.

## 📊 Current Status

✅ **Working stocks** (with Security IDs): TCS, WIPRO, INFY, ICICIBANK, RELIANCE, etc. (~50 stocks)  
❌ **Missing stocks**: VLEGOV, VIPULLTD, VAKRANGEE, etc. (25 stocks)

---

## 🎯 **Option 1: Interactive Helper Script** (Recommended)

This script helps you add security IDs one by one:

```bash
cd /Users/nelli/Desktop/intraq-signals/backend
python3 add_security_ids.py
```

**How it works:**
1. Shows each missing symbol
2. You find the security ID manually
3. Enter it when prompted
4. Script generates TypeScript code to copy

**Where to find Security IDs:**
- Method 1: Go to https://www.dhan.co/ → Search stock → Check URL: `https://www.dhan.co/stocks/detail/<SECURITY_ID>`
- Method 2: Open stock page → Browser DevTools (F12) → Network tab → Look for API calls with security_id parameter

---

## 🤖 **Option 2: Use yfinance for Unknown Stocks** (Current Setup)

The backend is **already configured** to use Yahoo Finance as fallback!

**Pros:**
- No need to find security IDs
- Works for most NSE stocks
- Automatic fallback

**Cons:**
- Yahoo Finance might not have all stocks
- Some stocks might be delisted or unavailable

**Status:** ✅ Already working! The issue is that:
- VLEGOV, VIPULLTD, etc. might be **delisted** or **not on Yahoo Finance**
- yfinance is working but returns no data for these specific stocks

---

## 🔧 **Option 3: NSE Master File** (Advanced)

Download the NSE scrip master file and extract security IDs:

```bash
# Download NSE securities master
curl -o nse_scrips.csv "https://www.nseindia.com/content/equities/EQUITY_L.csv"

# Parse and match symbols
python3 parse_nse_scrips.py
```

*(Script to be created if needed)*

---

## 💡 **My Recommendation**

**For now, use what's working:**

1. ✅ **Backtest the stocks that have security IDs** (~50 stocks)
2. ⏭️ **Skip the 25 missing stocks** (they might be delisted or illiquid)
3. 📝 **Manually add security IDs** for any important stocks you need

---

## 🚀 **Quick Start**

### Test Current Setup:

```bash
# 1. Make sure backend is running
curl -s http://localhost:5001/health

# 2. Refresh your browser
# 3. Click "Backtest" button
# 4. You'll see: "✅ Backtested" for ~50 stocks
#                "❌ 25 stocks failed" (the ones without IDs)
```

### Add Missing IDs:

```bash
cd /Users/nelli/Desktop/intraq-signals/backend
python3 add_security_ids.py
```

Follow prompts to add IDs for important stocks.

---

## 📋 **Missing Symbols List**

The following stocks need security IDs:

```
VLEGOV
VIPULLTD
VAKRANGEE
TVVISION
TPHQ
TGL
TECHLABS
SUPREMEENG
SHANKARA
SADHNANIQ
RSSOFTWARE
PAR
ODIGMA
NOIDATOLL
NMSTEEL
LCCINFOTEC
KESORAMIND
JALAN
GSS
GENSOL
DRONE
DIL
AGSTRA
AFFORDABLE
ABFRL
```

**Note:** Some of these might be penny stocks, delisted, or illiquid stocks that don't have reliable data.

---

## ✅ **What's Already Working**

Your backtesting **is working perfectly** for stocks with security IDs!

Example working stocks:
- TCS: 11536 ✅
- WIPRO: 3787 ✅
- INFY: 1594 ✅
- ICICIBANK: 4963 ✅
- RELIANCE: 2885 ✅
- HDFCBANK: 1333 ✅
- And 50+ more!

---

## 🎯 **Next Steps**

1. **Try backtesting now** - it will work for the 50+ mapped stocks
2. **Decide** if you need the missing 25 stocks
3. **If yes**, use the interactive script to add them
4. **If no**, just remove them from your CSV files

---

Need help? Check the backend logs:
```bash
tail -f /tmp/intraq-backend.log
```

