#!/bin/bash
# =============================================================================
# Deploy CinePass to the VM (run from your Mac):
#
#   ./scripts/deploy-vm.sh            # sync + build + restart
#   ./scripts/deploy-vm.sh --setup    # also (re)install the systemd unit + nginx site
#
# The site runs as a systemd service behind nginx, like the other *.bonnaf.com
# apps. It sits next to the Pathé scraper, which is what lets "refresh now" read
# seats live (see README-pathe-seats.md).
# =============================================================================

set -euo pipefail

VM_HOST="${VM_HOST:-vm}"
DOMAIN="${DOMAIN:-cinepass.bonnaf.com}"
PORT="${PORT:-3210}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_DIR="cinepass"

echo "==> Syncing project to $VM_HOST:~/$REMOTE_DIR..."
# .env.local stays server-side: the VM has extra settings (local scraper, WARP proxy).
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .env.local \
  "$PROJECT_DIR/" "$VM_HOST:~/$REMOTE_DIR/"

if [ "${1:-}" = "--setup" ]; then
  echo "==> Ensuring server-side .env.local..."
  if ! ssh "$VM_HOST" "test -f ~/$REMOTE_DIR/.env.local"; then
    scp -q "$PROJECT_DIR/.env.local" "$VM_HOST:~/$REMOTE_DIR/.env.local"
  fi
  ssh "$VM_HOST" bash -s <<REMOTE
cd ~/$REMOTE_DIR
grep -q PATHE_LOCAL_SCRAPER .env.local || printf '\n# Read seats live: the scraper runs here (see README-pathe-seats.md)\nPATHE_LOCAL_SCRAPER=1\nPATHE_PYTHON=/home/dev/venv-pathe/bin/python\nPATHE_PROXY=socks5://127.0.0.1:40000\n' >> .env.local
REMOTE

  echo "==> Installing systemd unit cinepass.service..."
  ssh "$VM_HOST" bash -s <<REMOTE
set -e
sudo tee /etc/systemd/system/cinepass.service >/dev/null <<UNIT
[Unit]
Description=CinePass ($DOMAIN)
After=network.target

[Service]
User=dev
WorkingDirectory=/home/dev/$REMOTE_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -p $PORT
Restart=always
RestartSec=5
MemoryMax=900M

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable cinepass >/dev/null
REMOTE

  echo "==> Installing nginx site $DOMAIN..."
  ssh "$VM_HOST" bash -s <<REMOTE
set -e
if [ ! -f /etc/nginx/sites-available/$DOMAIN ]; then
  sudo tee /etc/nginx/sites-available/$DOMAIN >/dev/null <<SITE
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_read_timeout 120s;
    }
}
SITE
  sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
fi
sudo nginx -t && sudo systemctl reload nginx
REMOTE
fi

echo "==> Installing deps and building on VM..."
ssh "$VM_HOST" bash -s <<REMOTE
set -e
cd ~/$REMOTE_DIR
npm install --no-audit --no-fund
npm run build
REMOTE

echo "==> Restarting service..."
ssh "$VM_HOST" "sudo systemctl restart cinepass && sleep 4 && systemctl is-active cinepass"

echo "==> Checking the app answers on 127.0.0.1:$PORT..."
ssh "$VM_HOST" "curl -sf -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:$PORT/"

echo ""
echo "==> Deployed. Logs: ssh $VM_HOST 'journalctl -u cinepass -f'"
