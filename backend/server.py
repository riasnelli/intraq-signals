"""
Flask Backend for Dhan API Integration
Handles all Dhan API calls and serves data to React frontend
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from dhanhq import dhanhq
import os
from datetime import datetime

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
        data = request.json
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

@app.route('/api/historical-data', methods=['POST', 'OPTIONS'])
def get_historical_data():
    """
    Fetch historical intraday data for a symbol
    
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
    try:
        data = request.json
        client_id = data.get('clientId')
        access_token = data.get('accessToken')
        symbol = data.get('symbol')
        security_id = data.get('securityId')
        exchange_segment = data.get('exchangeSegment', 'NSE_EQ')
        date = data.get('date')
        
        if not all([client_id, access_token, symbol, security_id, date]):
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
        
        # Convert date to required format
        from_date = f"{date} 09:15:00"
        to_date = f"{date} 15:30:00"
        
        # Fetch historical data
        # Using 5-minute interval
        historical_data = dhan.historical_daily_data(
            security_id=security_id,
            exchange_segment=exchange_segment,
            instrument_type="EQUITY",
            from_date=from_date,
            to_date=to_date
        )
        
        if not historical_data or 'data' not in historical_data:
            return jsonify({
                'success': False,
                'error': 'No data received from Dhan API'
            }), 404
        
        # Parse and format data
        formatted_data = []
        for tick in historical_data['data']:
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
            'date': date,
            'dataPoints': len(formatted_data),
            'data': formatted_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
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
        data = request.json
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
    
    app.run(host='0.0.0.0', port=port, debug=debug)

