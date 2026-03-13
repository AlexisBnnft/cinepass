#!/bin/bash
# CinePass daily scraper - runs on VM via cron
# Starts Next.js server, scrapes, then kills the server
set -euo pipefail

CINEPASS_DIR="$HOME/cinepass"
LOG_FILE="$HOME/logs/cinepass-scrape.log"
SCRAPE_SECRET="${SCRAPE_SECRET:-cinepass-scrape-2024}"
PORT=3000

mkdir -p "$HOME/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# Kill any leftover Next.js server on this port
lsof -ti:$PORT 2>/dev/null | xargs -r kill -9 2>/dev/null || true

log "Starting Next.js server..."
cd "$CINEPASS_DIR"
npm start -- -p $PORT &>/dev/null &
SERVER_PID=$!

# Cleanup: always kill the server on exit
trap "kill $SERVER_PID 2>/dev/null; lsof -ti:$PORT 2>/dev/null | xargs -r kill -9 2>/dev/null || true" EXIT

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -sf http://localhost:$PORT >/dev/null 2>&1; then
    break
  fi
  if [ "$i" = "30" ]; then
    log "FAIL: Server did not start in 30s"
    exit 1
  fi
  sleep 1
done

log "Server ready, starting scrape..."
response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:$PORT/api/scrape?force=true" \
  -H "Authorization: Bearer $SCRAPE_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 600)

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  log "OK: $body"
else
  log "FAIL (HTTP $http_code): $body"
fi
