# 🔌 Dhan API Integration Guide for Real Historical Data

## Current Problem
The backtest uses **mock/simulated data** that doesn't match real market prices. To get accurate backtest results, you need to integrate Dhan API for historical intraday data.

## Dhan API Documentation
- **Dhan API Docs**: https://dhanhq.co/docs/v2/
- **Historical Data Endpoint**: `/charts/historical`
- **Intraday Data**: Available in 1-minute, 5-minute intervals

## Step-by-Step Integration

### 1. Get Your Dhan API Credentials
You already have the UI for this in Settings:
- Client ID
- Access Token

These are stored in `localStorage` and can be accessed in the backtest logic.

### 2. Create Dhan API Service

Create a new file: `src/services/dhanApi.ts`

```typescript
// src/services/dhanApi.ts

interface DhanCredentials {
  clientId: string;
  accessToken: string;
}

interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class DhanApiService {
  private baseUrl = 'https://api.dhan.co';
  
  private getCredentials(): DhanCredentials | null {
    try {
      const stored = localStorage.getItem('dhan_credentials');
      if (!stored) return null;
      
      const creds = JSON.parse(stored);
      if (creds.clientId && creds.accessToken && creds.status === 'active') {
        return creds;
      }
      return null;
    } catch (e) {
      console.error('Failed to load Dhan credentials', e);
      return null;
    }
  }

  /**
   * Fetch historical intraday data for a specific date
   * @param symbol - Stock symbol (e.g., "WIPRO", "TCS")
   * @param date - Date in YYYY-MM-DD format
   * @param interval - Time interval: "1", "5", "15", "30", "60" (minutes)
   */
  async fetchIntradayData(
    symbol: string, 
    date: string, 
    interval: '1' | '5' | '15' = '5'
  ): Promise<OHLCData[]> {
    const creds = this.getCredentials();
    
    if (!creds) {
      throw new Error('Dhan API credentials not configured');
    }

    // Convert date to required format
    const fromDate = `${date} 09:15:00`;
    const toDate = `${date} 15:30:00`;

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/charts/historical`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access-token': creds.accessToken,
            'client-id': creds.clientId,
          },
          body: JSON.stringify({
            symbol: symbol,
            exchange: 'NSE', // or 'BSE'
            instrument: 'EQUITY',
            from_date: fromDate,
            to_date: toDate,
            interval: interval,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Dhan API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        return this.parseOHLCData(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Dhan API fetch error:', error);
      throw error;
    }
  }

  private parseOHLCData(rawData: any[]): OHLCData[] {
    return rawData.map((tick: any) => ({
      timestamp: tick.timestamp || tick.time,
      open: parseFloat(tick.open),
      high: parseFloat(tick.high),
      low: parseFloat(tick.low),
      close: parseFloat(tick.close),
      volume: parseInt(tick.volume || 0),
    }));
  }

  /**
   * Get security ID for a symbol (required by some Dhan API endpoints)
   */
  async getSecurityId(symbol: string): Promise<string> {
    const creds = this.getCredentials();
    
    if (!creds) {
      throw new Error('Dhan API credentials not configured');
    }

    // Implementation depends on Dhan's symbol search API
    // You might need to maintain a local mapping or use their search endpoint
    
    return symbol; // Placeholder
  }
}

export const dhanApi = new DhanApiService();
```

### 3. Update Backtest Logic

Modify `src/backtest.ts`:

```typescript
import { dhanApi } from "./services/dhanApi";

// Check if we can use real data
async function shouldUseRealData(): Promise<boolean> {
  try {
    const credentials = localStorage.getItem('dhan_credentials');
    if (!credentials) return false;
    
    const parsed = JSON.parse(credentials);
    return parsed.clientId && parsed.accessToken && parsed.status === 'active';
  } catch {
    return false;
  }
}

// Enhanced backtest function
export async function backtestSignal(signal: TSignal): Promise<TSignal> {
  const useRealData = await shouldUseRealData();
  
  let intradayData;
  
  if (useRealData) {
    try {
      console.log(`📡 Fetching real data for ${signal.symbol} on ${signal.date}`);
      
      // Fetch real historical data from Dhan
      const ohlcData = await dhanApi.fetchIntradayData(
        signal.symbol,
        signal.date,
        '5' // 5-minute intervals
      );
      
      // Convert to our format
      intradayData = ohlcData.map(tick => ({
        time: new Date(tick.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        price: tick.close,
        high: tick.high,
        low: tick.low,
      }));
      
      console.log(`✅ Fetched ${intradayData.length} real data points`);
      
    } catch (error) {
      console.error(`❌ Failed to fetch real data, falling back to mock:`, error);
      // Fallback to mock data
      intradayData = generateMockIntradayData(signal.date, signal.symbol, signal.entry);
    }
  } else {
    console.log(`🎭 Using mock data for ${signal.symbol}`);
    // Use mock data
    intradayData = generateMockIntradayData(signal.date, signal.symbol, signal.entry);
  }
  
  // Rest of the backtest logic remains the same...
  // Check entry hits, target hits, SL hits
  
  // ... existing code ...
}
```

### 4. Add Visual Indicator

Update the UI to show when real vs mock data is used:

```tsx
// In your backtest results display
{batch.signals.some((s: any) => s.backtest) && (
  <div className="text-xs text-slate-400 mb-2">
    {batch.usedRealData ? (
      <span className="text-green-400">
        ✅ Using real historical data from Dhan API
      </span>
    ) : (
      <span className="text-yellow-400">
        ⚠️ Using simulated mock data (configure Dhan API for real data)
      </span>
    )}
  </div>
)}
```

### 5. Add Caching

Since historical data doesn't change, cache it to avoid repeated API calls:

```typescript
// src/services/dhanCache.ts

interface CacheEntry {
  data: any;
  timestamp: number;
}

class DhanCache {
  private cache = new Map<string, CacheEntry>();
  private ttl = 24 * 60 * 60 * 1000; // 24 hours

  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    // Persist to IndexedDB for long-term storage
    this.saveToDb(key, data);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return this.loadFromDb(key);
    }
    
    // Check if expired (though historical data never expires)
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private async saveToDb(key: string, data: any) {
    // Save to IndexedDB
    await db.historicalData.put({ key, data, timestamp: Date.now() });
  }

  private async loadFromDb(key: string): Promise<any | null> {
    const record = await db.historicalData.get(key);
    return record?.data || null;
  }
}

export const dhanCache = new DhanCache();

// Usage in dhanApi.ts:
async fetchIntradayData(...): Promise<OHLCData[]> {
  const cacheKey = `${symbol}_${date}_${interval}`;
  
  // Check cache first
  const cached = dhanCache.get(cacheKey);
  if (cached) {
    console.log('📦 Using cached data');
    return cached;
  }
  
  // Fetch from API
  const data = await this.fetchFromApi(...);
  
  // Cache for future use
  dhanCache.set(cacheKey, data);
  
  return data;
}
```

## Testing Your Integration

### 1. Test with Known Data
Compare your backtest results with actual market data:

```
Real Wipro 11 Nov:
- 09:15: 241.03
- High: 242.05
- Low: 238.81

Your Backtest Should Match These Exactly!
```

### 2. Error Handling
Handle these scenarios:
- ❌ API credentials invalid
- ❌ Symbol not found
- ❌ Date out of range
- ❌ Rate limit exceeded
- ❌ Network error

### 3. Fallback Strategy
```
Try Real Data → API Error? → Use Mock Data → Show Warning
```

## Benefits of Real Data Integration

✅ **Accurate Results** - Match actual market behavior  
✅ **Real Win Rates** - Know true strategy performance  
✅ **Reliable Insights** - Make data-driven decisions  
✅ **Audit Trail** - Verify backtest accuracy  
✅ **Confidence** - Trust your analytics  

## Cost Considerations

- **API Rate Limits** - Dhan may have call limits
- **Caching Strategy** - Cache historical data (it never changes)
- **Batch Requests** - Fetch multiple symbols together if API supports it
- **Fallback** - Always have mock data as fallback

## Current vs Future State

### Current (Mock Data)
```
Entry: 241.10 (random)
Hit at: 11:45 AM (simulated)
Result: May not reflect reality
```

### Future (Real Data)
```
Entry: 241.03 (real Dhan data)
Hit at: 09:15 AM (actual market time)
Result: Matches what really happened
```

## Implementation Priority

1. ✅ **Phase 1**: Mock data (DONE - current state)
2. 🔄 **Phase 2**: Dhan API integration (YOUR NEXT STEP)
3. 📊 **Phase 3**: Caching & optimization
4. 🎯 **Phase 4**: Multi-source data (NSE, BSE, etc.)

## Need Help?

Would you like me to:
1. Implement the full Dhan API integration?
2. Add caching layer for historical data?
3. Create error handling for API failures?
4. Add UI indicators for data source (real vs mock)?

Just let me know and I'll implement it! 🚀

