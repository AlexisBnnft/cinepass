#!/bin/bash
# =============================================================================
# Install the Pathé seat scraper on the VM (run from your Mac):
#
#   ./scripts/setup-pathe-seats-vm.sh
#
# Installs, if missing:
#   - Cloudflare WARP in proxy mode (Pathé refuses the VM's own IP on /api/*)
#   - a Python venv with curl_cffi + playwright, and Chromium
#   - two cron jobs: a sweep every 15 min, and the "refresh now" queue every min
# =============================================================================

set -euo pipefail

VM_HOST="${VM_HOST:-vm}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SWEEP_CRON="${SWEEP_CRON:-*/15 * * * *}"

echo "==> Installing Cloudflare WARP (proxy mode) if needed..."
ssh "$VM_HOST" bash -s <<'REMOTE'
set -e
if ! command -v warp-cli >/dev/null 2>&1; then
  curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg \
    | sudo gpg --yes --dearmor -o /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" \
    | sudo tee /etc/apt/sources.list.d/cloudflare-client.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq cloudflare-warp
fi

sudo systemctl enable --now warp-svc >/dev/null 2>&1 || true
sleep 2
warp-cli --accept-tos registration show >/dev/null 2>&1 || warp-cli --accept-tos registration new
# Proxy mode keeps the VM's default routing intact: only the scraper uses WARP.
warp-cli --accept-tos mode proxy
warp-cli --accept-tos proxy port 40000
warp-cli --accept-tos connect || true
sleep 5
if curl -s -m 10 --socks5 127.0.0.1:40000 https://cloudflare.com/cdn-cgi/trace | grep -q '^warp=on'; then
  echo "    WARP proxy OK on 127.0.0.1:40000"
else
  echo "    WARP proxy NOT reachable — check: warp-cli status"
  exit 1
fi
REMOTE

echo "==> Installing Python deps and Chromium if needed..."
ssh "$VM_HOST" bash -s <<'REMOTE'
set -e
if [ ! -x "$HOME/venv-pathe/bin/python" ]; then
  python3 -m venv "$HOME/venv-pathe"
fi
"$HOME/venv-pathe/bin/pip" -q install --upgrade curl_cffi playwright
if ! ls "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux/chrome >/dev/null 2>&1; then
  npx --yes playwright install chromium
fi
"$HOME/venv-pathe/bin/python" -c "import curl_cffi, playwright; print('    python deps OK')"
REMOTE

echo "==> Uploading scraper..."
ssh "$VM_HOST" "mkdir -p ~/cinepass/scripts ~/logs"
scp -q "$SCRIPT_DIR/pathe-seats.py" "$SCRIPT_DIR/pathe-seats-vm.sh" "$VM_HOST:~/cinepass/scripts/"
ssh "$VM_HOST" "chmod +x ~/cinepass/scripts/pathe-seats-vm.sh"

echo "==> Installing cron jobs..."
ssh "$VM_HOST" bash -s <<REMOTE
(crontab -l 2>/dev/null | grep -v pathe-seats-vm ; \
 echo "$SWEEP_CRON \$HOME/cinepass/scripts/pathe-seats-vm.sh" ; \
 echo "* * * * * \$HOME/cinepass/scripts/pathe-seats-vm.sh --queue") | crontab -
crontab -l | grep pathe
REMOTE

echo ""
echo "==> Done."
echo "    logs:  ssh $VM_HOST 'tail -f ~/logs/pathe-seats.log'"
echo "    test:  ssh $VM_HOST '~/cinepass/scripts/pathe-seats-vm.sh --limit 5'"
