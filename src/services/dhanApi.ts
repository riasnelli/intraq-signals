// Dhan API Service for fetching real historical market data
import { getSecurityId } from '../utils/dhanSecurityIds';

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
   * Fetch historical intraday data for a specific symbol and date via backend
   * @param symbol - Stock symbol (e.g., "WIPRO", "TCS")
   * @param date - Date in YYYY-MM-DD format
   * @param exchange - Exchange (NSE or BSE), defaults to NSE
   * @returns Object with data and dataSource
   */
  async fetchIntradayData(
    symbol: string,
    date: string,
    exchange: 'NSE' | 'BSE' = 'NSE'
  ): Promise<{ data: IntradayDataPoint[], dataSource?: 'dhan' | 'yfinance' }> {
    const creds = this.getCredentials();

    // Allow fetching even without credentials - backend will use Yahoo Finance fallback
    console.log(`📡 Fetching historical data for ${symbol} on ${date} via backend...`);
    console.log(`📋 Backend URL: ${this.backendUrl}`);
    if (!creds) {
      console.warn(`⚠️ Dhan credentials not configured, backend will use Yahoo Finance fallback`);
    }

    try {
      const securityId = getSecurityId(symbol);
      
      const requestBody = {
        clientId: creds?.clientId || '',
        accessToken: creds?.accessToken || '',
        symbol: symbol,
        securityId: securityId,
        exchangeSegment: exchange === 'NSE' ? 'NSE_EQ' : 'BSE_EQ',
        date: date
      };
      
      if (securityId === "0") {
        console.warn(`⚠️ No security ID found for ${symbol}, may fail to fetch real data`);
      }
      
      console.log(`📤 Request to backend:`, requestBody);
      
      const response = await fetch(`${this.backendUrl}/api/historical-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`📥 Backend response status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log(`📦 Backend response:`, data);

      if (response.ok && data.success && data.data) {
        const source = data.dataSource || 'unknown';
        const sourceLabel = source === 'dhan' ? '🟢 Dhan API' : source === 'yfinance' ? '🟡 Yahoo Finance' : 'unknown';
        console.log(`✅ Fetched ${data.dataPoints} real data points for ${symbol} from ${sourceLabel}`);
        return {
          data: data.data,
          dataSource: source as 'dhan' | 'yfinance'
        };
      } else {
        const errorMsg = data.error || 'Failed to fetch data from backend';
        console.error(`❌ Backend returned error:`, errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error(`❌ Backend fetch error for ${symbol}:`, error.message);
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

