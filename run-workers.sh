#!/bin/bash
# Auto-trigger workers for local development
# Run this in a separate terminal: ./run-workers.sh

echo "Starting worker polling (Ctrl+C to stop)..."
while true; do
  curl -s http://localhost:3000/api/workers/ingestion > /dev/null
  sleep 2
  curl -s http://localhost:3000/api/workers/vectorization > /dev/null
  echo "Workers triggered at $(date +%H:%M:%S)"
  sleep 5
done
