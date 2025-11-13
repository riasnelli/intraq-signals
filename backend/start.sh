#!/bin/bash

# Kill any existing backend processes
echo "🛑 Stopping existing backend processes..."
pkill -9 -f "server.py" 2>/dev/null
sleep 1

# Start the backend server
echo "🚀 Starting backend server on port 5001..."
cd /Users/nelli/Desktop/intraq-signals/backend

# Run with proper Python path
export PYTHONPATH="/Users/nelli/Library/Python/3.9/lib/python/site-packages:$PYTHONPATH"
python3 server.py


