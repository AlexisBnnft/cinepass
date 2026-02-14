# CinePass

Showtimes for Parisian cinemas, scraped from AlloCine.

## Stack

- **Next.js** (App Router)
- **Turso** (SQLite cloud database)
- **Tailwind CSS**

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in your Turso credentials and scrape secret
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `SCRAPE_SECRET` | Secret for the `/api/scrape` endpoint |

## Scraping

Trigger a scrape (protected by `SCRAPE_SECRET`):

```bash
curl -X POST https://your-site.com/api/scrape -H "Authorization: Bearer YOUR_SECRET"
```

A cron script is provided in `scripts/scrape-cron.sh`.
