#!/bin/bash

echo "🔄 Restarting Backend Server..."

# Kill any existing server on port 5000
lsof -ti:5000 | xargs kill -9 2>/dev/null || true

# Wait a moment
sleep 1

# Start the server
python server.py

