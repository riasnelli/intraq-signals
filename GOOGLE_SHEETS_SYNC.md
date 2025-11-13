# 📊 Google Sheets Sync Setup Guide

## ✨ Features

- ✅ **Auto-sync** signals, AI rankings, and backtest results to Google Sheets
- ✅ **Cloud backup** - Never lose your data
- ✅ **Access anywhere** - View on phone, tablet, any browser
- ✅ **Easy sharing** - Share with team or export to Excel
- ✅ **No OAuth needed** - Simple webhook setup
- ✅ **Free** - Uses Google's infrastructure

---

## 🚀 Quick Setup (5 Minutes)

### **Step 1: Create a Google Sheet**

1. Go to [Google Sheets](https://sheets.google.com)
2. Click **"+ Blank"** to create new spreadsheet
3. Name it: **"IntraQ Signals Backup"**

---

### **Step 2: Add Apps Script**

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any default code
3. **Copy and paste** the script below:

```javascript
// IntraQ Signals - Google Sheets Sync Script
// This receives data from your app and writes it to the sheet

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    
    // Handle different actions
    if (data.action === 'test') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Connection successful!',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action === 'sync_signals') {
      const signalsData = data.data;
      
      // Get or create "Signals" sheet
      let signalsSheet = sheet.getSheetByName('Signals');
      if (!signalsSheet) {
        signalsSheet = sheet.insertSheet('Signals');
        
        // Add headers
        const headers = [
          'Date', 'Symbol', 'Strategy', 'Side', 'Score', 'Entry', 'Target', 'Stop Loss', 'R:R', 'Sector',
          'GPT', 'Perp', 'Deep', 'Final',
          'Gap%', 'Vol Surge%', 'ATR', 'Vol Rank', 'Trend', 'RS 20D', 'VWAP%', 'Liquidity',
          'Entry Hit', 'Entry Time', 'Target Hit', 'Target Time', 'SL Hit', 'SL Time', 'Outcome', 'Data Source'
        ];
        signalsSheet.appendRow(headers);
        
        // Format header row
        const headerRange = signalsSheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#1e293b');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');
      }
      
      // Clear old data for this date (keep headers)
      if (signalsData.length > 0) {
        const firstDate = signalsData[0].date;
        const dataRange = signalsSheet.getDataRange();
        const values = dataRange.getValues();
        
        // Find and delete rows for this date
        for (let i = values.length - 1; i >= 1; i--) {
          if (values[i][0] === firstDate) {
            signalsSheet.deleteRow(i + 1);
          }
        }
      }
      
      // Add new data
      signalsData.forEach(signal => {
        signalsSheet.appendRow([
          signal.date,
          signal.symbol,
          signal.strategy,
          signal.side,
          signal.score,
          signal.entry,
          signal.target,
          signal.stopLoss,
          signal.riskReward,
          signal.sector,
          signal.chatGptRank || '',
          signal.perplexityRank || '',
          signal.deepSeekRank || '',
          signal.finalRank || '',
          signal.gapPercent || '',
          signal.preMarketVolumeSurge || '',
          signal.atr14 || '',
          signal.volatilityRank || '',
          signal.trendStatus || '',
          signal.relativeStrength20D || '',
          signal.vwapDistancePercent || '',
          signal.liquidityRating || '',
          signal.entryHit ? 'Yes' : 'No',
          signal.entryHitTime || '',
          signal.targetHit ? 'Yes' : 'No',
          signal.targetHitTime || '',
          signal.slHit ? 'Yes' : 'No',
          signal.slHitTime || '',
          signal.outcome || '',
          signal.dataSource || ''
        ]);
      });
      
      // Auto-resize columns
      signalsSheet.autoResizeColumns(1, 30);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Synced ${signalsData.length} signals`,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Click **Save** (💾 icon)
5. Click **Deploy** → **New deployment**
6. Click **⚙️ Select type** → Choose **"Web app"**
7. Configure:
   - **Description:** IntraQ Signals Sync
   - **Execute as:** Me
   - **Who has access:** Anyone
8. Click **Deploy**
9. **Copy the Web App URL** (looks like: `https://script.google.com/macros/s/ABC123.../exec`)
10. Click **Done**

---

### **Step 3: Connect Your App**

1. **Refresh your browser** (Cmd+Shift+R)
2. Click **⚙️ Settings** icon (top right)
3. Find **"Google Sheets Sync"** section
4. **Paste your webhook URL**
5. Click **"Test Connection"**
6. If successful: ✅ **"Sync Active"**
7. Click **"Save"**

---

### **Step 4: Done! Auto-Sync is Active**

Every time you:
- Save signals → Auto-syncs to Sheets ✅
- Save AI rankings → Auto-syncs to Sheets ✅
- Complete backtest → Auto-syncs to Sheets ✅

---

## 📊 **Your Google Sheet Will Have:**

### **Columns (30 total):**
```
A: Date
B: Symbol
C: Strategy
D: Side
E: Score
F: Entry
G: Target
H: Stop Loss
I: R:R
J: Sector
K: GPT Rank
L: Perp Rank
M: Deep Rank
N: Final Rank
O: Gap%
P: Vol Surge%
Q: ATR
R: Vol Rank
S: Trend
T: RS 20D
U: VWAP%
V: Liquidity
W: Entry Hit
X: Entry Time
Y: Target Hit
Z: Target Time
AA: SL Hit
AB: SL Time
AC: Outcome
AD: Data Source
```

### **Example Data:**
```
2025-11-13 | ASIANPAINT | Momentum | LONG | 6.57 | 2858.90 | ... | 4 | 1 | 2 | 2 | ... | dhan
2025-11-13 | JSWSTEEL   | Momentum | LONG | 4.08 | 1191.70 | ... | 2 | 2 | - | 1 | ... | dhan
```

---

## 🔄 **Manual Sync**

If auto-sync fails or you want to force sync:

1. View History → Open any batch
2. Click **"Sync to Sheets"** button
3. All data syncs immediately

---

## 🎯 **Benefits:**

1. **Backup:** All data in cloud
2. **Analysis:** Use Google Sheets formulas
3. **Sharing:** Share link with team
4. **Mobile:** View on phone
5. **Export:** Download as Excel/PDF
6. **History:** Google Sheets auto-saves versions
7. **Filtering:** Use Sheets filters/pivot tables

---

## ⚠️ **Troubleshooting:**

### **"Test Connection Failed"**
- Check webhook URL (must end with `/exec`)
- Ensure deployment is "Anyone" access
- Try deploying again (get new URL)

### **"No data in sheet"**
- Check Apps Script has no errors
- View Apps Script logs: Executions tab
- Ensure auto-sync is enabled

### **"Duplicate data"**
- Script auto-deletes old data for same date
- Each sync replaces previous data for that date

---

## 🔒 **Security:**

- Webhook URL is safe to use (read/write to YOUR sheet only)
- No sensitive credentials exposed
- Only you can access your Google Sheet (unless you share it)
- Data encrypted in transit (HTTPS)

---

## 💡 **Pro Tips:**

1. **Bookmark your sheet** for quick access
2. **Create charts** in Google Sheets for visualization
3. **Use conditional formatting** to highlight winners/losers
4. **Share read-only** with your team
5. **Export weekly** to Excel for offline analysis

---

## 🎊 **Next Steps:**

After setup, you'll have:
- ✅ Auto-sync to Google Sheets (cloud backup)
- ✅ JSON export/import (offline backup)
- ✅ CSV download (quick export)

**Three layers of data protection!** 🛡️

