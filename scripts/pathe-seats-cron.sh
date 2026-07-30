#!/bin/bash
# Refresh Pathé seat availability. Meant to be run every ~30 min by launchd/cron
# from a machine on a residential connection (see README-pathe-seats.md).
#
# Works both from the repo (scripts/) and from the copy the setup script installs
# outside ~/Documents, where launchd is allowed to read files.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SEATS_PY="$HERE/pathe-seats.py"
LOG_FILE="${CINEPASS_SEATS_LOG:-$HOME/logs/pathe-seats.log}"
mkdir -p "$(dirname "$LOG_FILE")"

# Pick a Python that has playwright + curl_cffi installed.
find_python() {
  for candidate in "${PATHE_PYTHON:-}" /opt/anaconda3/bin/python3 "$HOME/venv-pathe/bin/python" \
                   /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
    [ -n "$candidate" ] && [ -x "$candidate" ] || continue
    if "$candidate" -c "import curl_cffi, playwright" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON=$(find_python) || {
  echo "[$(date '+%F %T')] FAIL: no python with curl_cffi + playwright (pip install curl_cffi playwright)" >> "$LOG_FILE"
  exit 1
}

cd "$HERE" || exit 1
{
  echo "[$(date '+%F %T')] --- run start ($PYTHON)"
  "$PYTHON" "$SEATS_PY" "$@" 2>&1
  echo "[$(date '+%F %T')] --- run end (exit $?)"
} >> "$LOG_FILE"

# Keep the log from growing forever.
if [ "$(wc -l < "$LOG_FILE")" -gt 5000 ]; then
  tail -2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
