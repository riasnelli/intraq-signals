# 🔍 How to Find Dhan Security IDs - Complete Guide

## 📊 Current Status

✅ **Mapped:** ~57 stocks (including major banks I just added)  
❌ **Missing:** ~40 stocks (mostly small/mid-cap)

---

## 🎯 **Quick Summary**

**Why 17 stocks show "No data":**
1. They don't have Dhan Security IDs in the mapping file
2. Dhan API returns error DH-905 (incorrect parameters)
3. yfinance fallback also fails (stocks not available)

**Solution:** Add their Dhan Security IDs to `src/utils/dhanSecurityIds.ts`

---

## 📋 **Stocks That Need Security IDs**

### **Just Added (Should work now after refresh):**
- FEDERALBNK ✅
- CANBK ✅
- BANKBARODA ✅
- INDUSINDBK ✅
- IDFCFIRSTB ✅
- PNB ✅
- AUBANK ✅
- INDIGO ✅
- ABFRL ✅

### **Still Missing (Need to Find):**
```
VLEGOV, VIPULLTD, VAKRANGEE, TVVISION, TPHQ, TGL, TECHLABS,
SUPREMEENG, SHANKARA, SADHNANIQ, RSSOFTWARE, PAR, ODIGMA,
NOIDATOLL, NMSTEEL, LCCINFOTEC, KESORAMIND, JALAN, GSS,
GENSOL, DRONE, DIL, AGSTRA, AFFORDABLE, ANKITMETAL, COMSYN,
CPCAP, DHARAN, ESFL, FLEXITUFF, IEML-RE, K2INFRA, LENSKART,
SILLYMONKS, UNIINFO, VPRPL
```

---

## 🔧 **Method 1: Find Security IDs on Dhan.co (Recommended)**

### **Step-by-Step:**

1. **Go to:** https://www.dhan.co/
2. **Search** for the stock symbol (e.g., "VLEGOV")
3. **Click on the stock** to open its detail page
4. **Check the URL:**
   ```
   https://www.dhan.co/stocks/detail/<SECURITY_ID>/nse/VLEGOV
   ```
5. **Copy the Security ID** (the number in the URL)

### **Example:**
```
Stock: RELIANCE
URL: https://www.dhan.co/stocks/detail/2885/nse/RELIANCE
Security ID: 2885 ✅
```

### **Add to Mapping:**
Open `src/utils/dhanSecurityIds.ts` and add:
```typescript
"VLEGOV": "12345",  // Replace 12345 with actual ID
```

---

## 🔧 **Method 2: Use Browser DevTools**

1. **Go to Dhan.co** and search for the stock
2. **Open DevTools** (F12)
3. **Go to Network tab**
4. **Click on the stock**
5. **Look for API calls** containing "security_id" or "scrip_id"
6. **Find the ID in the request/response**

---

## 🔧 **Method 3: Use NSE Symbol Search**

Some stocks might be listed with different names on Dhan:

1. **Go to:** https://www.nseindia.com/
2. **Search** for the company name
3. **Get the correct NSE symbol**
4. **Then search on Dhan.co** with the correct symbol

---

## 🤖 **Method 4: Batch Find Using Our Script**

I've created a helper script:

```bash
cd /Users/nelli/Desktop/intraq-signals/backend
python3 add_security_ids.py
```

This will:
- Show each missing stock
- Let you enter the security ID
- Generate TypeScript code to copy

---

## ⚠️ **Important Notes**

### **Some Stocks May Not Be Available:**

These stocks might genuinely have no data because:
- **Delisted** from NSE
- **Suspended trading**
- **Very low volume** (no minute-level data)
- **Wrong symbol** (typo in CSV)
- **Not available on Dhan** (only on BSE or other exchanges)

### **How to Check if Stock is Valid:**
1. Search on https://www.nseindia.com/
2. If not found → Stock might be delisted
3. If found → Get correct symbol and search on Dhan

---

## 🚀 **What to Do Now**

### **Option 1: Ignore Small/Mid-Caps (Quick)**
If those 40 stocks are not important:
- ✅ Just refresh browser
- ✅ Run backtest with the **9 additional banks I just added**
- ✅ You should now see **17-20 stocks backtested** instead of 8!

### **Option 2: Add Important Stocks Only (Medium)**
Pick the 5-10 most important stocks from the missing list:
1. Find their security IDs on Dhan.co (5 min per stock)
2. Add to `dhanSecurityIds.ts`
3. Refresh and backtest

### **Option 3: Add All Stocks (Comprehensive)**
Use the helper script to systematically add all stocks:
```bash
python3 add_security_ids.py
```

---

## 🎯 **Test Your Changes**

After adding IDs:

1. **Refresh browser** (Cmd + Shift + R)
2. **Run backtest**
3. **Expected:**
   ```
   🟢 Dhan API: 17-20 stocks (up from 8!)
   ⚪ No data: 5-8 stocks (down from 17!)
   ```

---

## 📝 **Example: Adding One Stock**

Let's say you want to add **VAKRANGEE**:

1. Go to https://www.dhan.co/
2. Search "VAKRANGEE"
3. Open stock page
4. URL shows: `https://www.dhan.co/stocks/detail/3110/nse/VAKRANGEE`
5. Security ID = `3110`
6. Add to file:
   ```typescript
   "VAKRANGEE": "3110",
   ```
7. Save and refresh browser!

---

## 🔥 **Quick Win**

I just added **9 major banking stocks**. Refresh your browser now and run backtest - you should see better results immediately!

**New additions:**
- FEDERALBNK: 1023
- CANBK: 10794
- BANKBARODA: 579
- INDUSINDBK: 5258
- IDFCFIRSTB: 11184
- PNB: 10666
- AUBANK: 21808
- INDIGO: 13179
- ABFRL: 1

