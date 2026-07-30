// Pathé session discovery.
//
// pathe.fr exposes two API surfaces:
//   - www.pathe.fr/api/*      → open, gives showtimes with a booking ref (V<vistaRef>S<sessionId>)
//   - s.pathe.fr/api/*        → seat maps, behind Akamai bot protection (see scripts/pathe-seats.py)
//
// This module only touches the open surface: it resolves our cinemas to their Pathé
// slug + Vista ref, then collects the session ids the seat scraper needs.

const API = "https://www.pathe.fr/api";

// allocine_code → pathe.fr cinema slug
const CINEMA_SLUGS: Record<string, string> = {
  C0060: "cinema-pathe-bnp-paribas",
  G02BG: "cinema-pathe-palace",
  C0024: "cinema-pathe-les-fauvettes",
  C0037: "cinema-pathe-alesia",
  C0052: "cinema-pathe-montparnos",
  C0158: "cinema-pathe-parnasse",
  C0161: "cinema-pathe-convention",
  C0116: "cinema-pathe-aquaboulevard",
  W7502: "cinema-pathe-beaugrenelle",
  C0179: "cinema-pathe-wepler",
  C0189: "cinema-la-geode",
  W7520: "cinema-pathe-la-villette",
  P7517: "cinema-les-7-batignolles",
};

export interface PatheSession {
  vistaRef: string;
  sessionId: number;
  cinemaId: number;
  cinemaSlug: string;
  showSlug: string;
  titleNorm: string;
  showDatetime: string; // YYYY-MM-DDTHH:MM
  version: string | null;
  auditorium: string | null;
  capacity: number | null;
}

/** Strip accents/punctuation so AlloCiné titles and Pathé slugs can be compared. */
export function normalizeTitle(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "spider-man-brand-new-day-47729" → "spidermanbrandnewday" */
function normalizeShowSlug(slug: string): string {
  return normalizeTitle(slug.replace(/-\d+$/, ""));
}

export function isPatheCinema(allocineCode: string): boolean {
  return allocineCode in CINEMA_SLUGS;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36" },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** slug → Vista ref ("3166"), used to build the booking/seatmap URLs. */
export async function fetchVistaRefs(): Promise<Record<string, string>> {
  const cinemas = await getJson<{ slug: string; vistaRef: string | null }[]>(`${API}/cinemas`);
  const refs: Record<string, string> = {};
  for (const c of cinemas ?? []) {
    if (c.vistaRef) refs[c.slug] = c.vistaRef;
  }
  return refs;
}

interface ShowsResponse {
  shows: Record<string, { days: Record<string, unknown> }>;
}

interface ShowtimeEntry {
  time: string; // "2026-07-30 13:00:00"
  version: string | null;
  refCmd: string | null; // "https://s.pathe.fr/fr/V3166S151771/booking"
  auditoriumName: string | null;
  auditoriumCapacity: string | null;
}

/**
 * Collect Pathé sessions for the given cinemas over `dates`.
 * One request per cinema + one per (show, cinema) pair, so we only walk shows
 * that actually play on one of the requested dates.
 */
export async function discoverPatheSessions(
  cinemas: { id: number; allocine_code: string }[],
  dates: string[],
  options: { onProgress?: (msg: string) => void; delayMs?: number } = {}
): Promise<{ sessions: PatheSession[]; errors: string[] }> {
  const wanted = new Set(dates);
  const vistaRefs = await fetchVistaRefs();
  const sessions: PatheSession[] = [];
  const errors: string[] = [];
  const delay = options.delayMs ?? 250;
  const sleep = () => new Promise((r) => setTimeout(r, delay));

  for (const cinema of cinemas) {
    const slug = CINEMA_SLUGS[cinema.allocine_code];
    if (!slug) continue;

    const vistaRef = vistaRefs[slug];
    if (!vistaRef) {
      errors.push(`${slug}: no vistaRef`);
      continue;
    }

    const shows = await getJson<ShowsResponse>(`${API}/cinema/${slug}/shows`);
    if (!shows?.shows) {
      errors.push(`${slug}: shows unavailable`);
      continue;
    }

    const showSlugs = Object.entries(shows.shows)
      .filter(([, v]) => Object.keys(v.days ?? {}).some((d) => wanted.has(d)))
      .map(([k]) => k);

    let found = 0;
    for (const showSlug of showSlugs) {
      await sleep();
      const byDate = await getJson<Record<string, ShowtimeEntry[]>>(
        `${API}/show/${showSlug}/showtimes/${slug}`
      );
      if (!byDate) {
        errors.push(`${slug}/${showSlug}: showtimes unavailable`);
        continue;
      }

      for (const [date, entries] of Object.entries(byDate)) {
        if (!wanted.has(date)) continue;
        for (const entry of entries) {
          const match = /\/V(\d+)S(\d+)\//.exec(entry.refCmd ?? "");
          if (!match) continue;
          const [, ref, sessionId] = match;
          const [d, t] = entry.time.split(" ");
          if (!d || !t) continue;

          sessions.push({
            vistaRef: ref,
            sessionId: Number(sessionId),
            cinemaId: cinema.id,
            cinemaSlug: slug,
            showSlug,
            titleNorm: normalizeShowSlug(showSlug),
            showDatetime: `${d}T${t.slice(0, 5)}`,
            version: entry.version,
            auditorium: entry.auditoriumName,
            capacity: entry.auditoriumCapacity ? Number(entry.auditoriumCapacity) : null,
          });
          found++;
        }
      }
    }
    options.onProgress?.(`${slug}: ${found} séances (${showSlugs.length} films)`);
  }

  return { sessions, errors };
}
