# Dhan API Backend Server

Flask backend that proxies Dhan API calls from the React frontend.

## 🚀 **Quick Start**

### **1. Install Python Dependencies**

```bash
cd backend
pip install -r requirements.txt
```

Or using virtual environment (recommended):

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### **2. Run the Server**

```bash
python server.py
```

Server will start on `http://localhost:5000`

### **3. Test the Server**

```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "status": "ok",
  "message": "Dhan API Backend is running",
  "timestamp": "2025-11-12T07:36:50"
}
```

## 📡 **API Endpoints**

### **Health Check**
```
GET /health
```

### **Test Connection**
```
POST /api/test-connection
Content-Type: application/json

{
  "clientId": "1108950558",
  "accessToken": "your_token_here"
}
```

### **Get Historical Data**
```
POST /api/historical-data
Content-Type: application/json

{
  "clientId": "1108950558",
  "accessToken": "your_token",
  "symbol": "WIPRO",
  "securityId": "3456",
  "exchangeSegment": "NSE_EQ",
  "date": "2025-11-12"
}
```

## 🔧 **Configuration**

Create a `.env` file (optional):

```env
PORT=5000
DEBUG=True
```

## 📦 **Dependencies**

- **Flask**: Web framework
- **flask-cors**: CORS support
- **dhanhq**: Official Dhan Python SDK
- **python-dotenv**: Environment variables

## 🔒 **Security Notes**

1. **Never commit access tokens** to git
2. Use environment variables for sensitive data
3. In production, use proper authentication
4. Set proper CORS origins

## 🐛 **Troubleshooting**

### **ImportError: No module named 'flask'**
```bash
pip install -r requirements.txt
```

### **Port 5000 already in use**
Change port in server.py or set environment variable:
```bash
PORT=5001 python server.py
```

### **CORS errors**
Make sure your React app URL is in the CORS origins list in `server.py`

## 📝 **Development**

To run in development mode with auto-reload:

```bash
export FLASK_ENV=development
export FLASK_APP=server.py
flask run
```

## 🚀 **Production Deployment**

For production, use a proper WSGI server like Gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 server:app
```

## 📊 **Testing with Curl**

Test connection:
```bash
curl -X POST http://localhost:5000/api/test-connection \
  -H "Content-Type: application/json" \
  -d '{"clientId":"1108950558","accessToken":"your_token"}'
```

Get historical data:
```bash
curl -X POST http://localhost:5000/api/historical-data \
  -H "Content-Type: application/json" \
  -d '{
    "clientId":"1108950558",
    "accessToken":"your_token",
    "symbol":"WIPRO",
    "securityId":"3456",
    "exchangeSegment":"NSE_EQ",
    "date":"2025-11-12"
  }'
```

## 🎯 **Next Steps**

1. Start the backend server
2. Update React app to use `http://localhost:5000` instead of `https://api.dhan.co`
3. Test with real credentials
4. Deploy to production server when ready

