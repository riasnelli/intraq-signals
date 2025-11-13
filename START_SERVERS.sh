#!/bin/bash

echo "═══════════════════════════════════════════"
echo "  Starting Intraq Signals Development Servers"
echo "═══════════════════════════════════════════"
echo ""

# Kill existing processes
echo "🛑 Stopping existing processes..."
pkill -9 -f "server.py" 2>/dev/null
pkill -9 -f "vite" 2>/dev/null
sleep 2

# Start backend
echo "🐍 Starting Python backend on port 5001..."
cd /Users/nelli/Desktop/intraq-signals/backend
export PYTHONPATH="/Users/nelli/Library/Python/3.9/lib/python/site-packages:$PYTHONPATH"
python3 server.py > /tmp/intraq-backend.log 2>&1 &
BACKEND_PID=$!

sleep 3

# Check if backend is running
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo "✅ Backend running on http://localhost:5001"
else
    echo "❌ Backend failed to start. Check /tmp/intraq-backend.log"
    exit 1
fi

# Start frontend
echo "⚛️  Starting React frontend on port 3001..."
cd /Users/nelli/Desktop/intraq-signals
npm run dev > /tmp/intraq-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Servers Started!"
echo "═══════════════════════════════════════════"
echo ""
echo "📱 Frontend:  http://localhost:3001"
echo "🐍 Backend:   http://localhost:5001"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/intraq-backend.log"
echo "   Frontend: tail -f /tmp/intraq-frontend.log"
echo ""
echo "🛑 To stop: pkill -9 -f \"server.py|vite\""
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

