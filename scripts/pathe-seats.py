#!/usr/bin/env python3
"""
Snapshot Pathé seat availability into Turso.

Pathé's seat maps live on s.pathe.fr/api/*, behind Akamai bot protection:
  - the TLS fingerprint must look like Chrome's       → curl_cffi (impersonate)
  - a session must clear an Akamai JS challenge       → real Chrome over CDP, once per run
  - requests need an anonymous JWT the booking page mints (cmd-cgp-authtoken cookie)
  - datacenter IPs are refused on /api/* paths        → must run from a residential IP

So this script runs wherever such a connection is available (see README-pathe-seats.md),
reads the session ids discovered by /api/pathe/discover, and writes one snapshot row
per session. Everything the website needs is then plain DB reads.

Usage:
    python3 scripts/pathe-seats.py [--horizon-hours 8] [--max-age-min 25]
                                   [--limit 200] [--dry-run] [--session 3166/148694]
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import random
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

PARIS = ZoneInfo("Europe/Paris")
REPO = Path(__file__).resolve().parent.parent
CREDS_PATH = Path(os.path.expanduser("~/.cache/cinepass/pathe-creds.json"))
CHROME_PROFILE = Path(os.path.expanduser("~/.cache/cinepass/pathe-chrome-profile"))
CDP_PORT = int(os.environ.get("PATHE_CDP_PORT", "9422"))
CHROME_UA_FALLBACK = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36"
)

# Seat type → letter used in the compact layout (lowercase = free, uppercase = taken)
SEAT_LETTERS = {"STD": "s", "DUO": "u", "DIS": "p", "TRIO": "t", "LOGE": "l",
                "DBX": "b", "COCOON": "c", "LOUNGE": "g", "HOU": "h"}


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# --------------------------------------------------------------------------- env


def env_candidates() -> list[Path]:
    # Also runs from a copy outside the repo (launchd can't read ~/Documents), so
    # an .env sitting next to the script wins over the repo's .env.local.
    here = Path(__file__).resolve().parent
    paths = [Path(os.environ["CINEPASS_ENV"])] if os.environ.get("CINEPASS_ENV") else []
    return paths + [here / ".env", REPO / ".env.local", REPO / ".env"]


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    for path in env_candidates():
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    missing = [k for k in ("TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN") if not env.get(k)]
    if missing:
        sys.exit(f"missing env: {', '.join(missing)}")
    return env


# ------------------------------------------------------------------------- turso


class Turso:
    """Minimal Turso/libSQL HTTP client (no node/py driver needed)."""

    def __init__(self, url: str, token: str):
        self.endpoint = re.sub(r"^libsql://", "https://", url).rstrip("/") + "/v2/pipeline"
        self.token = token

    @staticmethod
    def _arg(value):
        if value is None:
            return {"type": "null"}
        if isinstance(value, bool):
            return {"type": "integer", "value": str(int(value))}
        if isinstance(value, int):
            return {"type": "integer", "value": str(value)}
        if isinstance(value, float):
            return {"type": "float", "value": value}
        return {"type": "text", "value": str(value)}

    def execute(self, statements: list[tuple[str, list]]) -> list[dict]:
        body = {
            "requests": [
                {"type": "execute", "stmt": {"sql": sql, "args": [self._arg(a) for a in args]}}
                for sql, args in statements
            ]
            + [{"type": "close"}]
        }
        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(body).encode(),
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read())
        results = []
        for item in payload.get("results", []):
            if item.get("type") == "error":
                raise RuntimeError(f"turso error: {item.get('error')}")
            results.append(item.get("response", {}))
        return results

    def query(self, sql: str, args: list | None = None) -> list[dict]:
        result = self.execute([(sql, args or [])])[0]
        rows_result = result.get("result", {})
        cols = [c["name"] for c in rows_result.get("cols", [])]
        out = []
        for row in rows_result.get("rows", []):
            values = []
            for cell in row:
                if cell["type"] == "null":
                    values.append(None)
                elif cell["type"] == "integer":
                    values.append(int(cell["value"]))
                elif cell["type"] == "float":
                    values.append(float(cell["value"]))
                else:
                    values.append(cell["value"])
            out.append(dict(zip(cols, values)))
        return out


SEATS_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS pathe_seats (
  vista_ref   TEXT NOT NULL,
  session_id  INTEGER NOT NULL,
  fetched_at  TEXT NOT NULL,
  room_name   TEXT,
  seats_total INTEGER NOT NULL,
  seats_free  INTEGER NOT NULL,
  col_count   INTEGER,
  layout      TEXT,
  PRIMARY KEY (vista_ref, session_id)
)
"""

UPSERT_SEATS = """
INSERT INTO pathe_seats (vista_ref, session_id, fetched_at, room_name, seats_total,
                         seats_free, col_count, layout)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(vista_ref, session_id) DO UPDATE SET
  fetched_at = excluded.fetched_at,
  room_name = excluded.room_name,
  seats_total = excluded.seats_total,
  seats_free = excluded.seats_free,
  col_count = excluded.col_count,
  layout = excluded.layout
"""


# ------------------------------------------------------------------- credentials


def find_chrome() -> str:
    candidates = [
        os.environ.get("PATHE_CHROME_PATH", ""),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "~/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/*",
        "~/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        hits = sorted(p for p in glob.glob(os.path.expanduser(candidate)) if os.path.isfile(p))
        if hits:
            return hits[-1]
    sys.exit("no Chrome/Chromium binary found (set PATHE_CHROME_PATH)")


def bootstrap_credentials(vista_ref: str, session_id: int) -> dict:
    """
    Load a real booking page in Chrome so Akamai's challenge is solved by their own
    script, then keep the resulting cookies + anonymous JWT for plain HTTP calls.
    """
    from playwright.sync_api import sync_playwright

    chrome = find_chrome()
    headless = os.environ.get("PATHE_HEADLESS", "1") == "1"
    # A cached 403 in the profile would poison the next run.
    subprocess.run(["rm", "-rf", str(CHROME_PROFILE)], check=False)
    CHROME_PROFILE.parent.mkdir(parents=True, exist_ok=True)

    args = [
        chrome,
        f"--remote-debugging-port={CDP_PORT}",
        f"--user-data-dir={CHROME_PROFILE}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--lang=fr-FR",
        "--window-size=1440,900",
        "--disable-blink-features=AutomationControlled",
        "about:blank",
    ]
    if headless:
        # Chrome advertises "HeadlessChrome" in headless mode, which Akamai blocks
        # outright, so the UA (and its client hints, below) are overridden.
        args.insert(1, "--headless=new")
        args.insert(2, f"--user-agent={CHROME_UA_FALLBACK}")
    if sys.platform.startswith("linux"):
        args.insert(1, "--no-sandbox")

    log(f"bootstrap: launching {os.path.basename(chrome)} ({'headless' if headless else 'headed'})")
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/version", timeout=1)
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError("Chrome did not expose the CDP endpoint")

        with sync_playwright() as pw:
            browser = pw.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP_PORT}")
            ctx = browser.contexts[0]
            page = ctx.new_page()
            if headless:
                cdp = ctx.new_cdp_session(page)
                cdp.send("Network.setUserAgentOverride", {
                    "userAgent": CHROME_UA_FALLBACK,
                    "acceptLanguage": "fr-FR,fr;q=0.9",
                    "userAgentMetadata": {
                        "brands": [
                            {"brand": "Not)A;Brand", "version": "8"},
                            {"brand": "Chromium", "version": "151"},
                            {"brand": "Google Chrome", "version": "151"},
                        ],
                        "fullVersion": "151.0.0.0",
                        "platform": "macOS" if sys.platform == "darwin" else "Linux",
                        "platformVersion": "15.0.0",
                        "architecture": "arm",
                        "model": "",
                        "mobile": False,
                    },
                })
            url = f"https://s.pathe.fr/fr/V{vista_ref}S{session_id}/booking"
            page.goto(url, wait_until="domcontentloaded", timeout=60000)

            jwt, cookies = None, {}
            for _ in range(20):
                page.wait_for_timeout(1500)
                cookies = {c["name"]: c["value"] for c in ctx.cookies("https://s.pathe.fr")}
                raw = cookies.get("cmd-cgp-authtoken")
                if raw:
                    try:
                        jwt = json.loads(urllib.parse.unquote(raw)).get("jwt")
                    except json.JSONDecodeError:
                        jwt = None
                if jwt and "bm_sv" in cookies:
                    break
            user_agent = page.evaluate("navigator.userAgent")
            page.close()

        if not jwt:
            raise RuntimeError("booking page did not hand out a JWT (challenge not cleared?)")
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except Exception:
            proc.kill()

    creds = {
        "jwt": jwt,
        "cookies": cookies,
        "user_agent": user_agent,
        # The JWT lasts 2h; refresh well before that.
        "expires_at": (datetime.now(PARIS) + timedelta(minutes=75)).isoformat(),
    }
    CREDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CREDS_PATH.write_text(json.dumps(creds))
    log("bootstrap: got JWT + Akamai cookies")
    return creds


def load_credentials(vista_ref: str, session_id: int, force: bool = False) -> dict:
    if not force and CREDS_PATH.exists():
        try:
            creds = json.loads(CREDS_PATH.read_text())
            if datetime.fromisoformat(creds["expires_at"]) > datetime.now(PARIS):
                return creds
        except (json.JSONDecodeError, KeyError, ValueError):
            pass
    return bootstrap_credentials(vista_ref, session_id)


# --------------------------------------------------------------------- seat maps


def make_http_session(creds: dict):
    from curl_cffi import requests

    session = requests.Session(impersonate="chrome")
    for name, value in creds["cookies"].items():
        session.cookies.set(name, value, domain=".pathe.fr")
    return session


def fetch_seat_map(http, creds: dict, vista_ref: str, session_id: int):
    url = f"https://s.pathe.fr/api/seatmap/fr-FR/{vista_ref}/{session_id}/map"
    return http.get(url, headers={
        "Accept": "application/json, text/plain, */*",
        "Authorization": f"Bearer {creds['jwt']}",
        "Referer": f"https://s.pathe.fr/fr/V{vista_ref}S{session_id}/booking",
        "Cache-Control": "no-cache",
    }, timeout=30)


def parse_seat_map(payload: dict) -> dict | None:
    """
    Turn Pathé's seat map into counts plus a compact grid.

    In their payload `status` is per-session occupancy (1 = taken, 0 = free) and
    `seatIndex` is the column, aisles included, so the grid can be rebuilt as-is.
    """
    maps = payload.get("maps") or []
    if not maps:
        return None
    room = maps[0]
    col_count = room.get("colCount") or 0
    row_names = room.get("rowsNames") or []

    rows, free, taken = [], 0, 0
    for index, cells in enumerate(room.get("seats", [])):
        grid = ["."] * col_count
        for cell in cells:
            seat_type = cell.get("seatType") or "STD"
            if seat_type == "NON":
                continue
            col = cell.get("seatIndex")
            if col is None or col >= col_count:
                continue
            letter = SEAT_LETTERS.get(seat_type, "o")
            if cell.get("status") == 1:
                grid[col] = letter.upper()
                taken += 1
            else:
                grid[col] = letter
                free += 1
        line = "".join(grid)
        name = row_names[index] if index < len(row_names) else None
        if line.strip(".") == "":
            continue  # spacer row between blocks
        rows.append({"name": name or "", "cells": line})

    return {
        "room_name": room.get("roomName"),
        "seats_total": free + taken,
        "seats_free": free,
        "col_count": col_count,
        "layout": {"cols": col_count, "rows": rows},
    }


# ------------------------------------------------------------------------- main


def select_sessions(db: Turso, args) -> list[dict]:
    """
    Two tiers, so tonight stays accurate without hammering Pathé for every session
    of the next two days:
      - soon (< --soon-hours away)  → refresh every --soon-age-min
      - later (< --later-hours away) → refresh every --later-age-min, filling the
        rest of the run's budget, oldest snapshot first
    """
    now = datetime.now(PARIS)
    rows = db.query(
        """
        SELECT ps.vista_ref, ps.session_id, ps.show_datetime, ps.auditorium, pt.fetched_at
        FROM pathe_sessions ps
        LEFT JOIN pathe_seats pt
          ON pt.vista_ref = ps.vista_ref AND pt.session_id = ps.session_id
        WHERE ps.show_datetime >= ? AND ps.show_datetime <= ?
        ORDER BY ps.show_datetime ASC
        """,
        [now.strftime("%Y-%m-%dT%H:%M"),
         (now + timedelta(hours=args.later_hours)).strftime("%Y-%m-%dT%H:%M")],
    )

    naive_now = now.replace(tzinfo=None)
    soon_limit = naive_now + timedelta(hours=args.soon_hours)
    soon, later = [], []
    for row in rows:
        try:
            starts_at = datetime.fromisoformat(row["show_datetime"])
        except ValueError:
            continue
        age_min = None
        if row.get("fetched_at"):
            try:
                age_min = (naive_now - datetime.fromisoformat(row["fetched_at"])).total_seconds() / 60
            except ValueError:
                age_min = None
        row["_age"] = age_min
        if starts_at <= soon_limit:
            if age_min is None or age_min >= args.soon_age_min:
                soon.append(row)
        elif age_min is None or age_min >= args.later_age_min:
            later.append(row)

    # Oldest (or never fetched) first, so the backlog rotates evenly.
    later.sort(key=lambda r: (r["_age"] is not None, r["_age"] or 0), reverse=True)
    return (soon + later)[:args.limit]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--soon-hours", type=float, default=4,
                        help="sessions starting within this window are kept fresh")
    parser.add_argument("--soon-age-min", type=int, default=25,
                        help="max snapshot age for the 'soon' tier")
    parser.add_argument("--later-hours", type=float, default=48,
                        help="how far ahead to keep a rough snapshot")
    parser.add_argument("--later-age-min", type=int, default=480,
                        help="max snapshot age for the 'later' tier")
    parser.add_argument("--limit", type=int, default=120, help="max sessions per run")
    parser.add_argument("--min-delay", type=float, default=1.2, help="seconds between requests")
    parser.add_argument("--session", help="refresh a single session, e.g. 3166/148694")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env = load_env()
    db = Turso(env["TURSO_DATABASE_URL"], env["TURSO_AUTH_TOKEN"])
    db.execute([(SEATS_TABLE_DDL.strip(), [])])

    if args.session:
        vista_ref, session_id = args.session.split("/")
        targets = [{"vista_ref": vista_ref, "session_id": int(session_id),
                    "show_datetime": "manual", "auditorium": None}]
    else:
        targets = select_sessions(db, args)

    if not targets:
        log("nothing to refresh")
        return 0
    log(f"{len(targets)} session(s) to refresh")

    creds = load_credentials(targets[0]["vista_ref"], targets[0]["session_id"])
    http = make_http_session(creds)

    ok, failed, refreshes, consecutive_failures, pending = 0, 0, 0, 0, []
    for index, target in enumerate(targets):
        vista_ref, session_id = target["vista_ref"], int(target["session_id"])
        try:
            response = fetch_seat_map(http, creds, vista_ref, session_id)
        except Exception as error:  # network hiccup, keep going
            log(f"  {vista_ref}/{session_id}: {type(error).__name__} {error}")
            failed += 1
            consecutive_failures += 1
            if consecutive_failures >= 5:
                log("5 failures in a row, stopping")
                break
            continue

        if response.status_code in (401, 403, 429):
            # Akamai drops the session every so often (roughly every hundred calls),
            # and the JWT only lives 2h: take the hint, back off, get new credentials.
            if refreshes >= 4:
                log(f"  {vista_ref}/{session_id}: HTTP {response.status_code}, too many refreshes, stopping")
                break
            refreshes += 1
            log(f"  {vista_ref}/{session_id}: HTTP {response.status_code}, refreshing credentials")
            time.sleep(5 + random.random() * 5)
            try:
                creds = load_credentials(vista_ref, session_id, force=True)
            except Exception as error:
                log(f"bootstrap failed: {error}")
                break
            http = make_http_session(creds)
            response = fetch_seat_map(http, creds, vista_ref, session_id)
            if response.status_code != 200:
                log(f"  still HTTP {response.status_code} after refresh, stopping")
                break

        if response.status_code != 200:
            log(f"  {vista_ref}/{session_id}: HTTP {response.status_code}")
            failed += 1
            consecutive_failures += 1
            if consecutive_failures >= 5:
                log("5 failures in a row, stopping")
                break
            continue
        consecutive_failures = 0

        parsed = parse_seat_map(response.json())
        if not parsed:
            log(f"  {vista_ref}/{session_id}: unexpected payload")
            failed += 1
            continue

        pending.append((UPSERT_SEATS, [
            vista_ref, session_id, datetime.now(PARIS).strftime("%Y-%m-%dT%H:%M:%S"),
            parsed["room_name"], parsed["seats_total"], parsed["seats_free"],
            parsed["col_count"], json.dumps(parsed["layout"], separators=(",", ":")),
        ]))
        ok += 1
        if index < 3 or args.session:
            log(f"  {vista_ref}/{session_id} {target['show_datetime']} "
                f"{parsed['room_name']}: {parsed['seats_free']}/{parsed['seats_total']} libres")

        if len(pending) >= 50 and not args.dry_run:
            db.execute(pending)
            pending = []
        if index < len(targets) - 1:
            time.sleep(args.min_delay + random.random() * 0.6)

    if pending and not args.dry_run:
        db.execute(pending)

    log(f"done: {ok} snapshot(s), {failed} failure(s)" + (" [dry-run]" if args.dry_run else ""))
    return 0 if ok or not targets else 1


if __name__ == "__main__":
    sys.exit(main())
