import { getDb } from "./index";
import { InValue } from "@libsql/client/web";

export interface MovieFilters {
  date?: string | null;
  genres?: string[];
  timeMin?: string | null;
  timeMax?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
}

export interface MovieRow {
  id: number;
  allocine_id: string | null;
  title: string;
  title_original: string | null;
  poster_url: string | null;
  genres: string | null;
  duration_min: number | null;
  director: string | null;
  synopsis: string | null;
  release_date: string | null;
  allocine_url: string | null;
  press_rating: number | null;
  user_rating: number | null;
  cinema_count: number;
}

export interface ShowtimeRow {
  id: number;
  show_date: string;
  show_time: string;
  version: string;
  format: string;
  cinema_id: number;
  cinema_name: string;
  arrondissement: number;
}

export interface CinemaRow {
  id: number;
  allocine_code: string;
  name: string;
  arrondissement: number;
  is_chain: number;
}

export async function getAllCinemas(): Promise<CinemaRow[]> {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM cinemas ORDER BY arrondissement, name");
  return result.rows as unknown as CinemaRow[];
}

export async function getMoviesWithFilters(filters: MovieFilters): Promise<MovieRow[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: InValue[] = [];

  if (filters.date) {
    conditions.push("s.show_date = ?");
    params.push(filters.date);
  }

  if (filters.timeMin) {
    conditions.push("s.show_time >= ?");
    params.push(filters.timeMin);
  }

  if (filters.timeMax) {
    conditions.push("s.show_time <= ?");
    params.push(filters.timeMax);
  }

  if (filters.genres && filters.genres.length > 0) {
    const genreClauses = filters.genres.map(() => "m.genres LIKE ?");
    conditions.push(`(${genreClauses.join(" OR ")})`);
    filters.genres.forEach((g) => params.push(`%${g}%`));
  }

  if (filters.search) {
    conditions.push("m.title LIKE ?");
    params.push(`%${filters.search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit || 100;
  const offset = ((filters.page || 1) - 1) * limit;

  const sql = `
    SELECT
      m.*,
      COUNT(DISTINCT s.cinema_id) as cinema_count
    FROM movies m
    JOIN showtimes s ON s.movie_id = m.id
    ${whereClause}
    GROUP BY m.id
    ORDER BY cinema_count DESC, m.title ASC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);
  const result = await db.execute({ sql, args: params });
  return result.rows as unknown as MovieRow[];
}

export async function getShowtimesForMovie(movieId: number, date?: string): Promise<ShowtimeRow[]> {
  const db = await getDb();
  const conditions = ["s.movie_id = ?"];
  const params: InValue[] = [movieId];

  if (date) {
    conditions.push("s.show_date = ?");
    params.push(date);
  }

  const sql = `
    SELECT
      s.id, s.show_date, s.show_time, s.version, s.format,
      c.id as cinema_id, c.name as cinema_name, c.arrondissement
    FROM showtimes s
    JOIN cinemas c ON c.id = s.cinema_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY c.name, s.show_datetime
  `;

  const result = await db.execute({ sql, args: params });
  return result.rows as unknown as ShowtimeRow[];
}

export async function getMovieById(id: number): Promise<MovieRow | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM movies WHERE id = ?", args: [id] });
  return result.rows[0] as unknown as MovieRow | undefined;
}

export async function upsertMovie(data: {
  allocineId: string | null;
  title: string;
  allocineUrl: string | null;
}): Promise<number> {
  const db = await getDb();

  if (data.allocineId) {
    const existing = await db.execute({
      sql: "SELECT id FROM movies WHERE allocine_id = ?",
      args: [data.allocineId],
    });
    if (existing.rows[0]) return existing.rows[0].id as number;
  }

  const existingByTitle = await db.execute({
    sql: "SELECT id FROM movies WHERE title = ?",
    args: [data.title],
  });
  if (existingByTitle.rows[0]) return existingByTitle.rows[0].id as number;

  const result = await db.execute({
    sql: "INSERT INTO movies (allocine_id, title, allocine_url) VALUES (?, ?, ?)",
    args: [data.allocineId, data.title, data.allocineUrl],
  });

  return Number(result.lastInsertRowid);
}

export async function insertShowtime(data: {
  movieId: number;
  cinemaId: number;
  showDate: string;
  showTime: string;
  showDatetime: string;
  version: string;
  format: string;
}): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO showtimes (movie_id, cinema_id, show_date, show_time, show_datetime, version, format)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [data.movieId, data.cinemaId, data.showDate, data.showTime, data.showDatetime, data.version, data.format],
  });
}

export async function deleteShowtimesForCinemaDate(cinemaId: number, date: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: "DELETE FROM showtimes WHERE cinema_id = ? AND show_date = ?",
    args: [cinemaId, date],
  });
}

export async function failScrapeRun(runId: number, error: string): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE scrape_runs
          SET completed_at = datetime('now'), status = 'failed', error_log = ?
          WHERE id = ?`,
    args: [error, runId],
  });
}

export async function updateMovieMetadata(
  movieId: number,
  data: {
    posterUrl?: string;
    genres?: string;
    durationMin?: number;
    director?: string;
    synopsis?: string;
    releaseDate?: string;
    pressRating?: number;
    userRating?: number;
  }
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const params: InValue[] = [];

  if (data.posterUrl) { sets.push("poster_url = ?"); params.push(data.posterUrl); }
  if (data.genres) { sets.push("genres = ?"); params.push(data.genres); }
  if (data.durationMin) { sets.push("duration_min = ?"); params.push(data.durationMin); }
  if (data.director) { sets.push("director = ?"); params.push(data.director); }
  if (data.synopsis) { sets.push("synopsis = ?"); params.push(data.synopsis); }
  if (data.releaseDate) { sets.push("release_date = ?"); params.push(data.releaseDate); }
  if (data.pressRating !== undefined) { sets.push("press_rating = ?"); params.push(data.pressRating); }
  if (data.userRating !== undefined) { sets.push("user_rating = ?"); params.push(data.userRating); }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(movieId);

  await db.execute({
    sql: `UPDATE movies SET ${sets.join(", ")} WHERE id = ?`,
    args: params,
  });
}

export async function getMoviesWithoutMetadata(): Promise<{ id: number; allocine_id: string }[]> {
  const db = await getDb();
  const result = await db.execute(
    "SELECT id, allocine_id FROM movies WHERE genres IS NULL AND allocine_id IS NOT NULL"
  );
  return result.rows as unknown as { id: number; allocine_id: string }[];
}

export async function createScrapeRun(startDate: string, endDate: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute({
    sql: "INSERT INTO scrape_runs (started_at, date_range_start, date_range_end, status) VALUES (datetime('now'), ?, ?, 'running')",
    args: [startDate, endDate],
  });
  return Number(result.lastInsertRowid);
}

export async function completeScrapeRun(
  runId: number,
  stats: { cinemasScraped: number; moviesFound: number; showtimesFound: number; errors: string[] }
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE scrape_runs
          SET completed_at = datetime('now'), status = 'completed',
              cinemas_scraped = ?, movies_found = ?, showtimes_found = ?,
              error_log = ?
          WHERE id = ?`,
    args: [stats.cinemasScraped, stats.moviesFound, stats.showtimesFound, JSON.stringify(stats.errors), runId],
  });
}

export async function getLastScrapeRun() {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM scrape_runs ORDER BY id DESC LIMIT 1");
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function getActiveScrapeRun() {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM scrape_runs WHERE status = 'running' LIMIT 1");
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function getDistinctGenres(): Promise<string[]> {
  const db = await getDb();
  const result = await db.execute("SELECT DISTINCT genres FROM movies WHERE genres IS NOT NULL");
  const genreSet = new Set<string>();
  for (const row of result.rows) {
    (row.genres as string).split(",").forEach((g) => genreSet.add(g.trim()));
  }
  return Array.from(genreSet).sort();
}

export async function getStats() {
  const db = await getDb();
  const movies = await db.execute("SELECT COUNT(*) as count FROM movies");
  const showtimes = await db.execute("SELECT COUNT(*) as count FROM showtimes");
  const cinemas = await db.execute("SELECT COUNT(*) as count FROM cinemas");
  return {
    movieCount: movies.rows[0].count as number,
    showtimeCount: showtimes.rows[0].count as number,
    cinemaCount: cinemas.rows[0].count as number,
  };
}
