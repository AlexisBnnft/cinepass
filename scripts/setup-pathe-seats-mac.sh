#!/bin/bash
# =============================================================================
# Install the Pathé seat scraper as a launchd agent on this Mac.
#
#   ./scripts/setup-pathe-seats-mac.sh          # install / reinstall
#   ./scripts/setup-pathe-seats-mac.sh --off    # remove
#
# Why the Mac and not the VM: Pathé's seat API (s.pathe.fr/api/*) answers 403 to
# datacenter IPs, so the scraper needs a residential connection. It runs every
# 30 minutes while the Mac is awake; the site always shows the snapshot age.
# =============================================================================

set -euo pipefail

LABEL="com.cinepass.pathe-seats"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INTERVAL="${INTERVAL:-1800}"

if [ "${1:-}" = "--off" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "==> removed $LABEL"
  exit 0
fi

echo "==> checking Python dependencies..."
PYTHON=""
for candidate in /opt/anaconda3/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [ -x "$candidate" ] && "$candidate" -c "import curl_cffi, playwright" >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "    no Python has curl_cffi + playwright. Install them, e.g.:"
  echo "      python3 -m pip install curl_cffi playwright"
  exit 1
fi
echo "    using $PYTHON"

chmod +x "$REPO_DIR/scripts/pathe-seats-cron.sh"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/logs"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$REPO_DIR/scripts/pathe-seats-cron.sh</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>CINEPASS_DIR</key>
        <string>$REPO_DIR</string>
        <key>PATHE_PYTHON</key>
        <string>$PYTHON</string>
    </dict>
    <key>StartInterval</key>
    <integer>$INTERVAL</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>$HOME/logs/pathe-seats.launchd.log</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "==> installed $LABEL (every ${INTERVAL}s)"
echo "    logs:  tail -f ~/logs/pathe-seats.log"
echo "    stop:  ./scripts/setup-pathe-seats-mac.sh --off"
