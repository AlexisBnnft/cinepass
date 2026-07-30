# CinePass

Showtimes for Parisian cinemas, scraped from AlloCine — with remaining seats and seat
maps for Pathé showtimes.

Live at [cinepass.bonnaf.com](https://cinepass.bonnaf.com).

## Stack

- **Next.js** (App Router)
- **Turso** (SQLite cloud database)
- **Tailwind CSS**
- Hosted on the VM: `cinepass.service` behind nginx (see [Hosting](#hosting))

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in your Turso credentials and scrape secret
npm run dev
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `TURSO_DATABASE_URL` | everywhere | Turso database URL |
| `TURSO_AUTH_TOKEN` | everywhere | Turso auth token |
| `SCRAPE_SECRET` | everywhere | Secret for `/api/scrape` and `/api/pathe/discover` |
| `PATHE_LOCAL_SCRAPER` | VM only | `1` to read Pathé seats live on demand |
| `PATHE_PYTHON` | VM only | Python with `curl_cffi` + `playwright` |
| `PATHE_PROXY` | VM only | Proxy the seat scraper goes out through (WARP) |

## Hosting

The site runs on the VM as `cinepass.service` (port 3210) behind nginx, with a
Let's Encrypt certificate managed by certbot — same pattern as the other
`*.bonnaf.com` apps. It sits next to the Pathé scraper on purpose: that adjacency is
what lets the "refresh now" button read seats live.

```bash
./scripts/deploy-vm.sh            # sync + build + restart
./scripts/deploy-vm.sh --setup    # also install the systemd unit + nginx site
ssh vm 'journalctl -u cinepass -f'
```

`.env.local` is deliberately **not** synced by the deploy: the VM's copy carries the
server-only settings above.

## Scraping

Two jobs, both on the VM, both driven by cron (`./scripts/setup-cron-vm.sh` installs
the daily one, `./scripts/setup-pathe-seats-vm.sh` the seat ones):

| When | What |
|---|---|
| 08:00 daily | `cinepass-scrape.sh` → AlloCiné showtimes, then Pathé session ids |
| every 15 min | `pathe-seats-vm.sh` → seat snapshots for upcoming showtimes |
| every minute | `pathe-seats-vm.sh --queue` → fallback path for the ↻ button |

Endpoints are protected by `SCRAPE_SECRET`:

```bash
curl -X POST https://cinepass.bonnaf.com/api/scrape -H "Authorization: Bearer YOUR_SECRET"
curl -X POST https://cinepass.bonnaf.com/api/pathe/discover -H "Authorization: Bearer YOUR_SECRET"
```

## Pathé seat availability

Pathé showtimes show how many seats are left, where they are, and a ↻ button that
re-reads them live (~1.5 s). Getting there needs a Chrome TLS fingerprint, an Akamai
challenge cleared by a real browser, and an egress IP Pathé accepts — all documented in
**[README-pathe-seats.md](README-pathe-seats.md)**, including the fallbacks if the
current setup ever gets blocked.
