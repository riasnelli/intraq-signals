#!/bin/bash

# Development startup script
# Starts both backend and frontend servers

echo "╔═══════════════════════════════════════════╗"
echo "║   Starting IntraQ Signals Development    ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if backend dependencies are installed
if [ ! -d "backend/venv" ]; then
    echo "📦 Setting up Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
    echo "✅ Backend dependencies installed"
fi

# Check if Node modules are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
    echo "✅ Frontend dependencies installed"
fi

echo ""
echo "🚀 Starting servers..."
echo ""

# Start backend in background
echo "▶️  Starting Python backend on http://localhost:5000"
cd backend
source venv/bin/activate
python server.py &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "▶️  Starting React frontend on http://localhost:3001"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   ✅ Both servers are running!            ║"
echo "║                                           ║"
echo "║   Backend:  http://localhost:5000         ║"
echo "║   Frontend: http://localhost:3001         ║"
echo "║                                           ║"
echo "║   Press Ctrl+C to stop both servers       ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Trap Ctrl+C and kill both processes
trap "echo '\n\n⏹️  Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Wait for processes
wait

