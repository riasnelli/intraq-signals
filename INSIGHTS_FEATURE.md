# 📊 Insights & Analytics Feature

## Overview
Comprehensive backtest analytics dashboard with interactive charts and AI-powered suggestions for improving trading performance.

## New Tech Stack Additions
- **Recharts** - React charting library for data visualization

## What's New

### 1. **Enhanced Database Schema** (`src/db.ts`)
- Added `sector` field to TSignal
- Extended backtest data with:
  - `outcome`: "target" | "sl" | "no_trigger"
  - `timeToTarget`: Minutes to reach target
  - `timeToSL`: Minutes to hit stop loss

### 2. **Sector Mapping** (`src/utils/sectorMap.ts`)
- Auto-categorizes 100+ Indian stocks into sectors:
  - IT, Banking, NBFC, Pharma, Auto, Energy, Metals, FMCG, Telecom, etc.
- Easily extensible for adding more stocks

### 3. **Analytics Hook** (`src/hooks/useBacktestInsights.ts`)
Computes real-time insights:
- **Heatmap Data**: Win-rate by score bands (≤2, 2-4, 4-6, 6-8, 8-10, 10+)
- **Histogram**: Time-to-target distribution (0-15min, 15-30min, 30-60min, etc.)
- **Sector Analysis**: Win-rate by sector with minimum trade filters
- **AI Suggestions**: Auto-generated recommendations for next trading day

### 4. **Chart Components**

#### a) **HeatmapGrid** (`src/components/HeatmapGrid.tsx`)
- Color-coded grid showing win-rate by score band
- Green = Higher win-rate, Red = Lower win-rate
- Shows wins/losses/total trades per band

#### b) **TimeToTargetHistogram** (`src/components/TimeToTargetHistogram.tsx`)
- Bar chart showing distribution of time taken to reach targets
- Helps identify optimal holding periods
- Dark-themed with smooth animations

#### c) **SectorWinRateBar** (`src/components/SectorWinRateBar.tsx`)
- Horizontal bar chart of sector performance
- Color-coded: Green (≥70%), Yellow (50-70%), Red (<50%)
- Filters out sectors with <3 trades for statistical significance

### 5. **Insights Page** (`src/components/Insights.tsx`)
Full-featured analytics dashboard with:

**Overview Stats:**
- Total Signals
- Entry Hits
- Targets Hit
- Overall Win Rate

**Charts:**
- Heatmap Grid (Score Band Analysis)
- Time to Target Histogram
- Sector Win-Rate Bar Chart

**AI Suggestions:**
- Preferred score bands to focus on
- Best performing sectors
- Optimal timing strategy (e.g., "Enter by 10:00 AM; exit if no progress by 10:30 AM")

**Performance Breakdown:**
- Winners count and percentage
- Losers count and percentage

## How to Use

### Step 1: Run Backtest
1. Go to **History** view
2. Click **🎯 Backtest** on any batch
3. Wait for backtest to complete

### Step 2: View Insights
1. After backtest completes, **📊 Insights** button appears
2. Click to open full analytics dashboard
3. Review charts and suggestions

### Step 3: Apply Learnings
- Focus on score bands with highest win-rate
- Trade stocks from top-performing sectors
- Follow timing recommendations for entries/exits

## Key Features

✅ **Fully Offline** - All analytics computed locally in browser  
✅ **Real-time** - Instant updates as you backtest  
✅ **Interactive Charts** - Hover for detailed tooltips  
✅ **Smart Filtering** - Auto-filters low-sample data  
✅ **Dark Theme** - Consistent with app design  
✅ **Responsive** - Works on mobile and desktop  
✅ **AI-Powered** - Auto-generates actionable suggestions  

## Technical Details

### Data Flow
1. User clicks "Backtest" → `backtestBatch()` runs
2. Each signal gets:
   - Sector assigned (via sectorMap)
   - Simulated intraday data
   - Entry/Target/SL hit times calculated
   - Outcome determined
3. Results saved to IndexedDB
4. User clicks "Insights" → Hook loads data
5. Charts and stats computed in real-time
6. Suggestions generated based on performance

### Performance
- **Heatmap**: O(n) - Linear scan of signals
- **Histogram**: O(n) - Single pass
- **Sector Analysis**: O(n) - Aggregation pass
- **Total**: Very fast even with 1000+ signals

### Customization
- **Score Bands**: Edit in `useBacktestInsights.ts`
- **Time Buckets**: Modify `TIME_BUCKETS_MIN` array
- **Sectors**: Add more stocks to `sectorMap.ts`
- **Colors**: Adjust in individual chart components

## Future Enhancements
- Export insights as PDF report
- Compare multiple batches side-by-side
- Machine learning predictions
- Real Dhan API integration
- Custom score band configuration UI
- Advanced filters (by sector, time, side)

## Bundle Size
- Added ~338KB to bundle (recharts + charts)
- Gzipped: ~102KB additional
- Performance: No noticeable impact

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Safari: ✅ Full support
- Firefox: ✅ Full support
- Mobile: ✅ Responsive design

