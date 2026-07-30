#!/bin/bash
# CinePass daily scraper - runs on VM via cron
# Starts Next.js server, scrapes, then kills the server
set -euo pipefail

CINEPASS_DIR="$HOME/cinepass"
LOG_FILE="$HOME/logs/cinepass-scrape.log"
SCRAPE_SECRET="${SCRAPE_SECRET:-cinepass-scrape-2024}"
PORT=3000            # fallback: temporary server
SITE_PORT=3210       # cinepass.service

mkdir -p "$HOME/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

# Free the port. lsof alone missed a leftover next-server bound to *:3000 once,
# which meant the scrape silently ran against a months-old build.
free_port() {
  local pids
  pids=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -z "$pids" ]; then
    pids=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  fi
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
    sleep 2
  fi
}

# The site normally runs as a systemd service (cinepass.service). Use it if it's up,
# and only spin up a throwaway server when it isn't.
if curl -sf "http://localhost:$SITE_PORT" >/dev/null 2>&1; then
  PORT=$SITE_PORT
  log "Using the running site on port $PORT"
else
  free_port

  log "Starting a temporary Next.js server on port $PORT..."
  cd "$CINEPASS_DIR"
  npm start -- -p $PORT &>/dev/null &
  SERVER_PID=$!

  # Cleanup: always kill the server on exit
  trap 'kill $SERVER_PID 2>/dev/null || true; free_port' EXIT

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
fi

# Make sure it's *our* build answering (an unauthenticated call returns 401 if the
# route exists, 404 if we're talking to a stale server).
route_check=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:$PORT/api/pathe/discover?days=1" --max-time 30)
if [ "$route_check" = "404" ]; then
  log "FAIL: port $PORT is served by an outdated build (got 404 on /api/pathe/discover)"
  exit 1
fi

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

# Refresh the Pathé booking session ids (used by the seat scraper, which runs
# separately from a residential IP — see README-pathe-seats.md)
log "Discovering Pathé sessions..."
pathe_response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:$PORT/api/pathe/discover?days=3" \
  -H "Authorization: Bearer $SCRAPE_SECRET" \
  --max-time 600)

pathe_code=$(echo "$pathe_response" | tail -1)
pathe_body=$(echo "$pathe_response" | sed '$d')

if [ "$pathe_code" = "200" ]; then
  log "Pathé OK: $(echo "$pathe_body" | head -c 300)"
else
  log "Pathé FAIL (HTTP $pathe_code): $(echo "$pathe_body" | head -c 300)"
fi
