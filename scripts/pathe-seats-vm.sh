#!/bin/bash
# Refresh Pathé seat availability from the VM, through the Cloudflare WARP proxy.
#
# Pathé answers 403 to this VM's own IP on /api/*, but accepts requests coming out
# of WARP (its egress is shared with consumer traffic). warp-svc runs in proxy mode,
# so only this script's traffic goes through it — the rest of the VM is untouched.
#
#   ~/cinepass/scripts/pathe-seats-vm.sh              # scheduled refresh
#   ~/cinepass/scripts/pathe-seats-vm.sh --queue      # handle "refresh now" clicks
set -uo pipefail

CINEPASS_DIR="${CINEPASS_DIR:-$HOME/cinepass}"
PYTHON="${PATHE_PYTHON:-$HOME/venv-pathe/bin/python}"
PROXY_PORT="${PATHE_PROXY_PORT:-40000}"
LOG_FILE="${CINEPASS_SEATS_LOG:-$HOME/logs/pathe-seats.log}"
LOCK_FILE="/tmp/cinepass-pathe-seats.lock"

mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "[$(date '+%F %T')] $1" >> "$LOG_FILE"; }

warp_ok() {
  curl -s -m 10 --socks5 "127.0.0.1:$PROXY_PORT" https://cloudflare.com/cdn-cgi/trace 2>/dev/null \
    | grep -q '^warp=on'
}

if ! warp_ok; then
  warp-cli --accept-tos connect >/dev/null 2>&1 || true
  sleep 6
  if ! warp_ok; then
    log "FAIL: WARP proxy not reachable on 127.0.0.1:$PROXY_PORT (warp-cli status)"
    exit 1
  fi
  log "WARP reconnected"
fi

# One run at a time: the every-minute queue worker must not collide with the
# scheduled sweep (which handles queued requests first anyway).
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

cd "$CINEPASS_DIR" || exit 1
{
  PATHE_PROXY="socks5://127.0.0.1:$PROXY_PORT" "$PYTHON" scripts/pathe-seats.py "$@" 2>&1
} >> "$LOG_FILE"

if [ "$(wc -l < "$LOG_FILE")" -gt 5000 ]; then
  tail -2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
