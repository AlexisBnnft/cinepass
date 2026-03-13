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

echo "==> Syncing repo to VM..."
ssh "$VM_HOST" bash -c "'
if [ -d ~/cinepass/.git ]; then
  cd ~/cinepass && git pull
else
  git clone git@github.com:AlexisBnnft/cinepass.git ~/cinepass
fi
'"

echo "==> Copying .env.local to VM..."
scp "$PROJECT_DIR/.env.local" "$VM_HOST:~/cinepass/.env.local"

echo "==> Installing deps and building on VM..."
ssh "$VM_HOST" bash -c "'
cd ~/cinepass
npm install
npm run build
'"

echo "==> Uploading scrape script to VM..."
scp "$SCRIPT_DIR/cinepass-scrape.sh" "$VM_HOST:~/cinepass-scrape.sh"
ssh "$VM_HOST" "chmod +x ~/cinepass-scrape.sh"

echo "==> Setting up cron job on VM..."
ssh "$VM_HOST" bash -c "'
mkdir -p ~/logs
(crontab -l 2>/dev/null | grep -v cinepass-scrape ; echo \"0 8 * * * \$HOME/cinepass-scrape.sh\") | crontab -
echo \"Cron installed:\"
crontab -l
'"

echo ""
echo "==> Done! Scraper will run daily at 8:00 AM UTC."
echo "    To test now:  ssh vm '~/cinepass-scrape.sh && tail ~/logs/cinepass-scrape.log'"
