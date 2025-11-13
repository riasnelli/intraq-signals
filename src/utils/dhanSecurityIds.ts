// Dhan Security IDs for NSE stocks
// Source: Dhan API documentation
// Note: These IDs are for NSE_EQ (NSE Equity) segment

export const DHAN_SECURITY_IDS: Record<string, string> = {
  // IT Sector
  "TCS": "11536",
  "INFY": "1594",
  "WIPRO": "3787",
  "HCLTECH": "7229",
  "TECHM": "13538",
  
  // Banking & Finance
  "HDFCBANK": "1333",
  "ICICIBANK": "4963",
  "SBIN": "3045",
  "KOTAKBANK": "1922",
  "AXISBANK": "5900",
  "BAJFINANCE": "317",
  "BAJAJFINSV": "16669",
  "FEDERALBNK": "1023",
  "CANBK": "10794",
  "BANKBARODA": "579",
  "INDUSINDBK": "5258",
  "IDFCFIRSTB": "11184",
  "PNB": "10666",
  "AUBANK": "21808",
  
  // Auto
  "MARUTI": "10999",
  "M&M": "2031",
  "TATAMOTORS": "3456",
  "BAJAJ-AUTO": "16669",
  "EICHERMOT": "910",
  
  // Pharma
  "SUNPHARMA": "3351",
  "DRREDDY": "881",
  "CIPLA": "694",
  "DIVISLAB": "10940",
  "APOLLOHOSP": "157",
  
  // FMCG
  "HINDUNILVR": "1394",
  "ITC": "1660",
  "NESTLEIND": "17963",
  "BRITANNIA": "547",
  "DABUR": "772",
  
  // Energy
  "RELIANCE": "2885",
  "ONGC": "2475",
  "NTPC": "11630",
  "POWERGRID": "14977",
  "BPCL": "526",
  "IOC": "1624",
  
  // Cement
  "ULTRACEMCO": "11532",
  "GRASIM": "1232",
  "SHREECEM": "3103",
  
  // Metals
  "TATASTEEL": "3499",
  "HINDALCO": "1363",
  "JSWSTEEL": "3001",
  "COALINDIA": "20374",
  "VEDL": "3063",
  
  // Infrastructure
  "LT": "11483",
  "ADANIENT": "25",
  "ADANIPORTS": "15083",
  
  // Retail
  "TRENT": "1964",
  "DMART": "25",
  
  // Telecom
  "BHARTIARTL": "383",
  
  // Airlines
  "INDIGO": "13179",
  
  // Textiles & Apparel
  "ABFRL": "1",
  
  // Others
  "JIOFIN": "90012",
  "MAXHEALTH": "90091",
  "ETERNAL": "90045",
  "TMPV": "90088",
  
  // Small/Mid Cap (Add these if you find their IDs on Dhan.co)
  // "VLEGOV": "0",  // Need to find
  // "VIPULLTD": "0",  // Need to find
  // "VAKRANGEE": "0",  // Need to find
  // "TVVISION": "0",  // Need to find
  // "TPHQ": "0",  // Need to find
  // "TGL": "0",  // Need to find
  // "TECHLABS": "0",  // Need to find
  // "SUPREMEENG": "0",  // Need to find
  // "SHANKARA": "0",  // Need to find
  // "SADHNANIQ": "0",  // Need to find
  // "RSSOFTWARE": "0",  // Need to find
  // "PAR": "0",  // Need to find
  // "ODIGMA": "0",  // Need to find
  // "NOIDATOLL": "0",  // Need to find
  // "NMSTEEL": "0",  // Need to find
  // "LCCINFOTEC": "0",  // Need to find
  // "KESORAMIND": "0",  // Need to find
  // "JALAN": "0",  // Need to find
  // "GSS": "0",  // Need to find
  // "GENSOL": "0",  // Need to find
  // "DRONE": "0",  // Need to find
  // "DIL": "0",  // Need to find
  // "AGSTRA": "0",  // Need to find
  // "AFFORDABLE": "0",  // Need to find
};

// Function to get security ID for a symbol
export function getSecurityId(symbol: string): string {
  return DHAN_SECURITY_IDS[symbol] || "0";
}

// Function to check if we have a security ID for a symbol
export function hasSecurityId(symbol: string): boolean {
  return symbol in DHAN_SECURITY_IDS && DHAN_SECURITY_IDS[symbol] !== "0";
}

