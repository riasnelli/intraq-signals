"""
Flask Backend for Dhan API Integration
Handles all Dhan API calls and serves data to React frontend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from dhanhq import dhanhq
import os
from datetime import datetime
import yfinance as yf
import pandas as pd

app = Flask(__name__)

# Configure CORS properly for development
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:3001", "http://localhost:5173", "http://localhost:3000"],
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type"],
         "supports_credentials": True
     }})

# Store active Dhan connections
dhan_clients = {}

@app.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    """Health check endpoint"""
    if request.method == 'OPTIONS':
        return '', 204
    return jsonify({
        'status': 'ok',
        'message': 'Dhan API Backend is running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/test-connection', methods=['POST', 'OPTIONS'])
def test_connection():
    """Test Dhan API connection"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Invalid JSON in request body'
            }), 400
            
        client_id = data.get('clientId')
        access_token = data.get('accessToken')
        
        if not client_id or not access_token:
            return jsonify({
                'success': False,
                'error': 'Missing clientId or accessToken'
            }), 400
        
        # Initialize Dhan client
        dhan = dhanhq(client_id, access_token)
        
        # Try to get fund limits as a test
        try:
            funds = dhan.get_fund_limits()
            
            # Store client for future use
            dhan_clients[client_id] = dhan
            
            return jsonify({
                'success': True,
                'message': 'Connection successful',
                'data': {
                    'availableBalance': funds.get('availableBalance', 0),
                    'sodLimit': funds.get('sodLimit', 0)
                }
            })
        except Exception as api_error:
            return jsonify({
                'success': False,
                'error': f'Dhan API error: {str(api_error)}'
            }), 401
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def fetch_yfinance_data(symbol, date_str):
    """
    Fallback: Fetch intraday data from Yahoo Finance
    Returns data in the same format as Dhan API or None if failed
    """
    try:
        print(f"📊 Attempting yfinance fallback for {symbol} on {date_str}")
        
        # Yahoo Finance uses .NS suffix for NSE stocks
        yf_symbol = f"{symbol}.NS"
        
        # Download intraday data for the specific date
        from datetime import timedelta
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        next_day = (date_obj + timedelta(days=1)).strftime('%Y-%m-%d')
        
        ticker = yf.Ticker(yf_symbol)
        # Get 1-minute interval data
        df = ticker.history(start=date_str, end=next_day, interval='1m')
        
        if df is None or df.empty:
            print(f"⚠️ yfinance returned no data for {yf_symbol}")
            return None
        
        print(f"✅ yfinance returned {len(df)} data points for {symbol}")
        
        # Convert to our format
        formatted_data = []
        for index, row in df.iterrows():
            time_str = index.strftime('%H:%M')
            formatted_data.append({
                'time': time_str,
                'price': float(row['Close']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'open': float(row['Open']),
                'volume': int(row['Volume'])
            })
        
        return formatted_data
        
    except Exception as e:
        print(f"❌ yfinance error for {symbol}: {str(e)}")
        return None


@app.route('/api/historical-data', methods=['POST', 'OPTIONS'])
def get_historical_data():
    """
    Fetch historical intraday data for a symbol
    Tries Dhan API first, falls back to Yahoo Finance if Dhan fails
    
    Request body:
    {
        "clientId": "1108950558",
        "accessToken": "...",
        "symbol": "WIPRO",
        "securityId": "3456",
        "exchangeSegment": "NSE_EQ",
        "date": "2025-11-12"
    }
    """
    if request.method == 'OPTIONS':
        return '', 204
    
    print("="*50)
    print("DEBUG: Received historical data request")
    print(f"DEBUG: Content-Type: {request.content_type}")
    print(f"DEBUG: Request data type: {type(request.data)}")
    print(f"DEBUG: Request data: {request.data}")
    
    try:
        data = request.get_json(force=True)
        print(f"DEBUG: Parsed JSON type: {type(data)}")
        print(f"DEBUG: Parsed JSON: {data}")
        
        if not data or not isinstance(data, dict):
            return jsonify({
                'success': False,
                'error': f'Invalid JSON in request body. Got type: {type(data)}'
            }), 400
            
        client_id = data.get('clientId')
        access_token = data.get('accessToken')
        symbol = data.get('symbol')
        security_id = data.get('securityId')
        exchange_segment = data.get('exchangeSegment', 'NSE_EQ')
        date_param = data.get('date')
        
        print(f"DEBUG: Extracted params - symbol: {symbol}, securityId: {security_id}, date: {date_param}")
        
        if not all([client_id, access_token, symbol, security_id, date_param]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        # Get or create Dhan client
        if client_id not in dhan_clients:
            dhan = dhanhq(client_id, access_token)
            dhan_clients[client_id] = dhan
        else:
            dhan = dhan_clients[client_id]
        
        # Convert date to required format for intraday minute data
        from_date = f"{date_param} 09:15:00"
        to_date = f"{date_param} 15:30:00"
        
        print(f"DEBUG: Calling Dhan API for {symbol} (intraday minute data)")
        print(f"DEBUG: Date range: {from_date} to {to_date}")
        print(f"DEBUG: Security ID: {security_id}")
        
        # Fetch intraday minute data
        historical_data = dhan.intraday_minute_data(
            security_id=security_id,
            exchange_segment=exchange_segment,
            instrument_type="EQUITY",
            from_date=from_date,
            to_date=to_date
        )
        
        print(f"DEBUG: Dhan API response type: {type(historical_data)}")
        print(f"DEBUG: Dhan API response: {historical_data}")
        
        # Check if response is valid
        dhan_failed = False
        dhan_error_msg = None
        
        if not historical_data:
            dhan_failed = True
            dhan_error_msg = 'No data received from Dhan API'
        elif isinstance(historical_data, str):
            dhan_failed = True
            dhan_error_msg = f'Dhan API error: {historical_data}'
        elif not isinstance(historical_data, dict):
            dhan_failed = True
            dhan_error_msg = f'Invalid response type from Dhan API: {type(historical_data)}'
        elif historical_data.get('status') == 'failure':
            # Dhan API returned explicit failure status
            dhan_failed = True
            error_info = historical_data.get('remarks', {})
            dhan_error_msg = f"Dhan API error: {error_info.get('error_code', 'Unknown')} - {error_info.get('error_message', 'No details')}"
        elif 'data' not in historical_data:
            dhan_failed = True
            dhan_error_msg = f'No data field in Dhan API response'
        elif isinstance(historical_data.get('data'), dict) and len(historical_data['data'].get('timestamp', [])) == 0:
            dhan_failed = True
            dhan_error_msg = 'Dhan API returned 0 data points'
        
        # Try yfinance fallback if Dhan failed
        if dhan_failed:
            print(f"⚠️ Dhan API failed: {dhan_error_msg}")
            print(f"🔄 Trying yfinance fallback...")
            
            yf_data = fetch_yfinance_data(symbol, date_param)
            
            if yf_data and len(yf_data) > 0:
                print(f"✅ yfinance fallback successful! Returning {len(yf_data)} data points")
                return jsonify({
                    'success': True,
                    'symbol': symbol,
                    'date': date_param,
                    'dataPoints': len(yf_data),
                    'data': yf_data,
                    'dataSource': 'yfinance'
                })
            else:
                print(f"❌ yfinance fallback also failed")
                return jsonify({
                    'success': False,
                    'error': f'Both Dhan API and yfinance failed. Dhan: {dhan_error_msg}, yfinance: No data'
                }), 404
        
        # Parse and format data
        # Dhan API returns data in array format: {'open': [...], 'high': [...], 'close': [...], 'timestamp': [...]}
        formatted_data = []
        data_dict = historical_data['data']
        
        # Check if data is in array format (new Dhan API format)
        if isinstance(data_dict, dict) and 'timestamp' in data_dict:
            timestamps = data_dict.get('timestamp', [])
            opens = data_dict.get('open', [])
            highs = data_dict.get('high', [])
            lows = data_dict.get('low', [])
            closes = data_dict.get('close', [])
            volumes = data_dict.get('volume', [])
            
            print(f"✅ Received {len(timestamps)} data points from Dhan API")
            
            for i in range(len(timestamps)):
                timestamp_value = timestamps[i]
                # Convert Unix timestamp to time string (HH:MM)
                from datetime import datetime
                dt = datetime.fromtimestamp(timestamp_value)
                time_str = dt.strftime('%H:%M')
                
                formatted_data.append({
                    'time': time_str,
                    'price': float(closes[i]) if i < len(closes) else 0,
                    'high': float(highs[i]) if i < len(highs) else 0,
                    'low': float(lows[i]) if i < len(lows) else 0,
                    'open': float(opens[i]) if i < len(opens) else 0,
                    'volume': int(volumes[i]) if i < len(volumes) else 0
                })
        else:
            # Fallback: try to parse as array of objects (old format)
            print(f"⚠️ Unexpected data format, attempting to parse as array")
            for tick in historical_data['data']:
                if not isinstance(tick, dict):
                    continue
                
                formatted_data.append({
                    'time': tick.get('timestamp', '').split(' ')[1] if ' ' in tick.get('timestamp', '') else tick.get('timestamp', ''),
                    'price': float(tick.get('close', 0)),
                    'high': float(tick.get('high', 0)),
                    'low': float(tick.get('low', 0)),
                    'open': float(tick.get('open', 0)),
                    'volume': int(tick.get('volume', 0))
                })
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'date': date_param,
            'dataPoints': len(formatted_data),
            'data': formatted_data,
            'dataSource': 'dhan'
        })
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR: Exception in historical_data endpoint")
        print(f"ERROR Type: {type(e)}")
        print(f"ERROR Message: {str(e)}")
        print(f"ERROR Traceback:\n{error_trace}")
        
        return jsonify({
            'success': False,
            'error': f'{type(e).__name__}: {str(e)}'
        }), 500

@app.route('/api/search-symbol', methods=['POST', 'OPTIONS'])
def search_symbol():
    """
    Search for a symbol to get its security ID
    
    Request body:
    {
        "clientId": "...",
        "accessToken": "...",
        "symbol": "WIPRO"
    }
    """
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'Invalid JSON in request body'
            }), 400
            
        client_id = data.get('clientId')
        access_token = data.get('accessToken')
        symbol = data.get('symbol')
        
        if not all([client_id, access_token, symbol]):
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        # Get or create Dhan client
        if client_id not in dhan_clients:
            dhan = dhanhq(client_id, access_token)
            dhan_clients[client_id] = dhan
        else:
            dhan = dhan_clients[client_id]
        
        # This is a placeholder - Dhan SDK might have a symbol search method
        # For now, we'll return a basic response
        # You may need to use a CSV file mapping symbols to security IDs
        
        return jsonify({
            'success': True,
            'symbol': symbol,
            'message': 'Symbol search not yet implemented. Please provide security ID manually.'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'True') == 'True'
    
    print(f"""
    ╔═══════════════════════════════════════════╗
    ║   Dhan API Backend Server                 ║
    ║   Running on http://localhost:{port}      ║
    ╚═══════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)

