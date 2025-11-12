// Dhan API Service for fetching real historical market data

interface DhanCredentials {
  clientId: string;
  accessToken: string;
  status?: string;
}

interface OHLCTick {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface IntradayDataPoint {
  time: string;
  price: number;
  high: number;
  low: number;
}

export class DhanApiService {
  private baseUrl = 'https://api.dhan.co';
  private backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

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
      console.error('Failed to load Dhan credentials:', e);
      return null;
    }
  }

  /**
   * Check if Dhan API credentials are configured and active
   */
  isConfigured(): boolean {
    return this.getCredentials() !== null;
  }

  /**
   * Fetch historical intraday data for a specific symbol and date
   * @param symbol - Stock symbol (e.g., "WIPRO", "TCS")
   * @param date - Date in YYYY-MM-DD format
   * @param exchange - Exchange (NSE or BSE), defaults to NSE
   */
  async fetchIntradayData(
    symbol: string,
    date: string,
    exchange: 'NSE' | 'BSE' = 'NSE'
  ): Promise<IntradayDataPoint[]> {
    const creds = this.getCredentials();

    if (!creds) {
      throw new Error('Dhan API credentials not configured');
    }

    // Format dates for Dhan API
    const fromDate = `${date} 09:15:00`;
    const toDate = `${date} 15:30:00`;

    console.log(`📡 Fetching historical data for ${symbol} on ${date} from Dhan API...`);
    const endpoint = `${this.baseUrl}/charts/historical`;
    console.log(`📋 Request details:`, {
      endpoint,
      symbol,
      exchange,
      fromDate,
      toDate
    });

    try {
      const requestBody = {
        symbol: symbol,
        exchangeSegment: exchange,
        instrument: 'EQUITY',
        expiryCode: 0,
        fromDate: fromDate,
        toDate: toDate,
        interval: 5, // 5-minute candles
      };
      
      console.log(`📤 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access-token': creds.accessToken,
          'client-id': creds.clientId,
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Dhan API error (${response.status}):`, errorText);
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error(`❌ Error details:`, errorJson);
          throw new Error(`Dhan API error (${response.status}): ${errorJson.message || errorJson.remarks || errorText}`);
        } catch {
          throw new Error(`Dhan API error (${response.status}): ${errorText}`);
        }
      }

      const data = await response.json();
      console.log(`📦 Response data:`, data);

      if (data.status === 'success' && data.data) {
        const parsedData = this.parseOHLCData(data.data);
        console.log(`✅ Fetched ${parsedData.length} real data points for ${symbol}`);
        return parsedData;
      } else {
        const errorMsg = data.remarks || data.message || 'Failed to fetch data from Dhan';
        console.error(`❌ Dhan API returned error:`, errorMsg, data);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error(`❌ Dhan API fetch error for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse OHLC data from Dhan API response
   */
  private parseOHLCData(rawData: any[]): IntradayDataPoint[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('No data received from Dhan API');
    }

    return rawData.map((tick: any) => {
      // Dhan API returns timestamp in format: "2024-11-12 09:15:00" or epoch
      const timestamp = tick.timestamp || tick.start_Time || tick.time;
      let timeStr: string;

      if (typeof timestamp === 'number') {
        // Epoch timestamp
        const date = new Date(timestamp * 1000);
        timeStr = date.toTimeString().slice(0, 5); // "HH:MM"
      } else {
        // String timestamp "2024-11-12 09:15:00"
        const parts = timestamp.split(' ');
        timeStr = parts[1]?.slice(0, 5) || '00:00';
      }

      return {
        time: timeStr,
        price: parseFloat(tick.close || tick.ltp || tick.last_price || 0),
        high: parseFloat(tick.high || tick.close || 0),
        low: parseFloat(tick.low || tick.close || 0),
      };
    }).filter(point => point.price > 0); // Filter out invalid data
  }

  /**
   * Test the API connection via backend
   */
  async testConnection(): Promise<boolean> {
    const creds = this.getCredentials();
    if (!creds) {
      console.error('❌ No credentials found');
      return false;
    }

    try {
      console.log('🔍 Testing Dhan API connection via backend...');
      console.log('📋 Backend URL:', this.backendUrl);
      console.log('📋 Using Client ID:', creds.clientId);
      console.log('📋 Access Token (first 20 chars):', creds.accessToken.substring(0, 20) + '...');
      
      const response = await fetch(`${this.backendUrl}/api/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: creds.clientId,
          accessToken: creds.accessToken,
        }),
      });

      console.log('📥 Backend response status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📦 Backend response:', data);
      
      if (response.ok && data.success) {
        console.log('✅ Test successful!');
        return true;
      } else {
        console.error('❌ Test failed:', data.error || 'Unknown error');
        return false;
      }
    } catch (error: any) {
      console.error('❌ Backend connection test failed:', error);
      console.error('❌ Error details:', error.message);
      console.warn('⚠️ Make sure backend server is running on', this.backendUrl);
      return false;
    }
  }
}

export const dhanApi = new DhanApiService();

