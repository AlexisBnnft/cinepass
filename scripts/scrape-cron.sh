#!/bin/bash
# Cron script to trigger CinePass scraping
# Usage: Add to crontab with: crontab -e
# Then add: 0 8,20 * * * /path/to/cinepass/scripts/scrape-cron.sh
#
# This will scrape at 8am and 8pm every day.

SITE_URL="${CINEPASS_URL:-https://your-site.netlify.app}"
SCRAPE_SECRET="${SCRAPE_SECRET:-cinepass-scrape-2024}"

echo "[$(date)] Triggering CinePass scrape..."
response=$(curl -s -w "\n%{http_code}" -X POST "${SITE_URL}/api/scrape" -H "Authorization: Bearer ${SCRAPE_SECRET}")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
  echo "[$(date)] Scrape completed: $body"
else
  echo "[$(date)] Scrape failed (HTTP $http_code): $body"
fi
