import { fetchCinemaShowtimes } from "./allocine";
import { RateLimiter } from "./rate-limiter";
import { ScrapeResult } from "./types";
import {
  getAllCinemas,
  upsertMovie,
  insertShowtime,
  deleteShowtimesForCinemaDate,
  updateMovieMetadata,
  createScrapeRun,
  completeScrapeRun,
  failScrapeRun,
} from "../db/queries";

function generateDateRange(start: string, days: number): string[] {
  const dates: string[] = [];
  const startDate = new Date(start);
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export async function scrapeAll(days = 6): Promise<{
  runId: number;
  results: ScrapeResult[];
  stats: { cinemasScraped: number; moviesFound: number; showtimesFound: number };
}> {
  const today = new Date().toISOString().split("T")[0];
  const dates = generateDateRange(today, days);
  const endDate = dates[dates.length - 1];

  const runId = await createScrapeRun(today, endDate);
  const cinemas = await getAllCinemas();
  const rateLimiter = new RateLimiter(2);
  const results: ScrapeResult[] = [];
  const movieCache = new Map<string, number>();
  const errors: string[] = [];
  let totalShowtimes = 0;

  try {
    for (const cinema of cinemas) {
      for (const date of dates) {
        await rateLimiter.throttle();

        try {
          const showtimes = await fetchCinemaShowtimes(cinema.allocine_code, date);

          // Delete old showtimes only for this cinema+date, right before inserting new ones
          await deleteShowtimesForCinemaDate(cinema.id, date);

          for (const st of showtimes) {
            const cacheKey = st.movieAllocineId || st.movieTitle;
            let movieId = movieCache.get(cacheKey);

            if (!movieId) {
              movieId = await upsertMovie({
                allocineId: st.movieAllocineId,
                title: st.movieTitle,
                allocineUrl: st.movieAllocineId
                  ? `https://www.allocine.fr/film/fichefilm_gen_cfilm=${st.movieAllocineId}.html`
                  : null,
              });
              movieCache.set(cacheKey, movieId);

              // Update metadata on first encounter
              await updateMovieMetadata(movieId, {
                posterUrl: st.moviePosterUrl || undefined,
                genres: st.movieGenres || undefined,
                durationMin: st.movieDurationMin || undefined,
                director: st.movieDirector || undefined,
                synopsis: st.movieSynopsis || undefined,
                releaseDate: st.movieReleaseDate || undefined,
                pressRating: st.moviePressRating ?? undefined,
                userRating: st.movieUserRating ?? undefined,
              });
            }

            await insertShowtime({
              movieId,
              cinemaId: cinema.id,
              showDate: st.showDate,
              showTime: st.showTime,
              showDatetime: st.showDatetime,
              version: st.version,
              format: st.format,
            });
            totalShowtimes++;
          }

          results.push({
            success: true,
            cinemaCode: cinema.allocine_code,
            date,
            showtimesCount: showtimes.length,
          });
        } catch (error) {
          const errMsg = `${cinema.name} (${cinema.allocine_code}) ${date}: ${(error as Error).message}`;
          errors.push(errMsg);
          results.push({
            success: false,
            cinemaCode: cinema.allocine_code,
            date,
            showtimesCount: 0,
            error: (error as Error).message,
          });
        }
      }
    }

    const stats = {
      cinemasScraped: cinemas.length,
      moviesFound: movieCache.size,
      showtimesFound: totalShowtimes,
      errors,
    };

    await completeScrapeRun(runId, stats);

    return { runId, results, stats };
  } catch (error) {
    await failScrapeRun(runId, (error as Error).message);
    throw error;
  }
}
