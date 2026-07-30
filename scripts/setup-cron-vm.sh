#!/bin/bash
# =============================================================================
# Setup CinePass scraper cron job on the VM
#
# Run from your Mac (from the cinepass directory):
#   ./scripts/setup-cron-vm.sh
#
# What it does:
#   1. Clones/updates the repo on the VM
#   2. Installs deps and builds
#   3. Copies .env.local to the VM
#   4. Uploads the scrape script
#   5. Sets up the cron job
# =============================================================================

set -euo pipefail

VM_HOST="vm"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Syncing project to VM via rsync..."
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude .env.local \
  "$PROJECT_DIR/" "$VM_HOST:~/cinepass/"

echo "==> Installing deps and building on VM..."
ssh "$VM_HOST" bash -c "'
cd ~/cinepass
npm install
npm run build
'"

echo "==> Making the scrape script executable..."
# Cron runs the script straight from the synced repo — a copy in ~ went stale once
# and the daily run silently used an old version.
ssh "$VM_HOST" "chmod +x ~/cinepass/scripts/cinepass-scrape.sh; rm -f ~/cinepass-scrape.sh"

echo "==> Setting up cron job on VM..."
ssh "$VM_HOST" bash -c "'
mkdir -p ~/logs
(crontab -l 2>/dev/null | grep -v cinepass-scrape ; echo \"0 8 * * * \$HOME/cinepass/scripts/cinepass-scrape.sh\") | crontab -
echo \"Cron installed:\"
crontab -l
'"

echo ""
echo "==> Done! Scraper will run daily at 8:00 AM UTC."
echo "    To test now:  ssh vm '~/cinepass/scripts/cinepass-scrape.sh && tail ~/logs/cinepass-scrape.log'"
