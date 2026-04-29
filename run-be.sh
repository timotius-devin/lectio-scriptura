#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -r requirements.txt -q

echo "Starting backend on http://localhost:8000"
uvicorn main:app --reload --port 8000
