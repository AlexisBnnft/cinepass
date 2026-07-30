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

## Hosting

The site runs on the VM (`cinepass.service` on port 3210, behind nginx at
`cinepass.bonnaf.com`), next to the Pathé scraper — that adjacency is what lets the
"refresh now" button read seats live.

```bash
./scripts/deploy-vm.sh            # sync + build + restart
./scripts/deploy-vm.sh --setup    # also install the systemd unit + nginx site
ssh vm 'journalctl -u cinepass -f'
```

`.env.local` is not synced: the VM's copy holds server-only settings
(`PATHE_LOCAL_SCRAPER`, `PATHE_PYTHON`, `PATHE_PROXY`).

## Scraping

Trigger a scrape (protected by `SCRAPE_SECRET`):

```bash
curl -X POST https://your-site.com/api/scrape -H "Authorization: Bearer YOUR_SECRET"
```

A cron script is provided in `scripts/scrape-cron.sh`.

## Pathé seat availability

Showtimes at Pathé cinemas also show how many seats are left and where they are.
Setup and constraints (the scraper has to run from a residential connection):
see [README-pathe-seats.md](README-pathe-seats.md).
