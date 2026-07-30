import { PatheSessionRow } from "./db/queries";
import { normalizeTitle } from "./scraper/pathe";

export interface SeatAvailability {
  vistaRef: string;
  sessionId: number;
  seatsFree: number | null;
  seatsTotal: number | null;
  fetchedAt: string | null;
  auditorium: string | null;
}

/** Our AlloCiné version labels → Pathé's version slugs. */
function patheVersion(version: string): string {
  return version === "VF" ? "vf" : "vost";
}

function titleTokens(title: string): string[] {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function slugTokens(showSlug: string | null): string[] {
  return (showSlug ?? "").replace(/-\d+$/, "").split("-").filter((t) => t.length > 1);
}

/**
 * Same movie, different naming: AlloCiné's "The Mask" is Pathé's
 * "la-seance-cine-hits-the-mask", "La Bataille de Gaulle : L'âge de fer" is
 * "la-bataille-de-gaulle-partie-1-l-age-de-fer". Accept a candidate when one title
 * contains the other, or when every word of our title shows up in their slug.
 */
function looksLikeSameMovie(session: PatheSessionRow, movieTitle: string): boolean {
  const movieNorm = normalizeTitle(movieTitle);
  const sessionNorm = session.title_norm ?? "";
  if (movieNorm.length > 3 && (sessionNorm.includes(movieNorm) || movieNorm.includes(sessionNorm))) {
    return true;
  }
  const theirs = new Set(slugTokens(session.show_slug));
  const ours = titleTokens(movieTitle);
  return ours.length > 0 && ours.every((t) => theirs.has(t));
}

/**
 * Index Pathé sessions by cinema + start time so showtimes can be resolved in one pass.
 * Several movies can start at the same minute in the same multiplex, so ambiguity is
 * settled by title and dropped entirely when it can't be — better no seat count than
 * the wrong screen's.
 */
export function indexPatheSessions(sessions: PatheSessionRow[]) {
  const byKey = new Map<string, PatheSessionRow[]>();
  for (const s of sessions) {
    const key = `${s.cinema_id}|${s.show_datetime}`;
    const list = byKey.get(key);
    if (list) list.push(s);
    else byKey.set(key, [s]);
  }

  return function resolve(
    showtime: { cinema_id: number; show_datetime: string; version: string },
    movieTitle: string
  ): SeatAvailability | null {
    const candidates = byKey.get(`${showtime.cinema_id}|${showtime.show_datetime}`);
    if (!candidates || candidates.length === 0) return null;

    let match: PatheSessionRow | undefined;
    if (candidates.length === 1) {
      match = candidates[0];
    } else {
      const titleNorm = normalizeTitle(movieTitle);
      let pool = candidates.filter((c) => c.title_norm === titleNorm);
      if (pool.length === 0) pool = candidates.filter((c) => looksLikeSameMovie(c, movieTitle));
      if (pool.length > 1) {
        const sameVersion = pool.filter((c) => c.version === patheVersion(showtime.version));
        if (sameVersion.length > 0) pool = sameVersion;
      }
      match = pool.length === 1 ? pool[0] : undefined;
    }
    if (!match) return null;

    return {
      vistaRef: match.vista_ref,
      sessionId: match.session_id,
      seatsFree: match.seats_free,
      seatsTotal: match.seats_total,
      fetchedAt: match.fetched_at,
      auditorium: match.auditorium,
    };
  };
}
