import { AllocineResponse, AllocineMovie, AllocineShowtimes, ParsedShowtime } from "./types";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: "https://www.allocine.fr/",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function fetchCinemaShowtimes(
  cinemaCode: string,
  date: string
): Promise<ParsedShowtime[]> {
  const url = `https://www.allocine.fr/_/showtimes/theater-${cinemaCode}/d-${date}/`;
  const text = await fetchWithRetry(url);
  const data: AllocineResponse = JSON.parse(text);

  if (data.error && (!data.results || data.results.length === 0)) {
    return [];
  }

  const allShowtimes: ParsedShowtime[] = [];

  for (const result of data.results) {
    if (!result.movie || !result.showtimes) continue;
    const parsed = parseMovieShowtimes(result.movie, result.showtimes, date);
    allShowtimes.push(...parsed);
  }

  // Handle pagination
  if (data.pagination && data.pagination.totalPages > 1) {
    for (let page = 2; page <= data.pagination.totalPages; page++) {
      const pageUrl = `https://www.allocine.fr/_/showtimes/theater-${cinemaCode}/d-${date}/?page=${page}`;
      try {
        const pageText = await fetchWithRetry(pageUrl);
        const pageData: AllocineResponse = JSON.parse(pageText);
        if (!pageData.error && pageData.results) {
          for (const result of pageData.results) {
            if (!result.movie || !result.showtimes) continue;
            allShowtimes.push(...parseMovieShowtimes(result.movie, result.showtimes, date));
          }
        }
      } catch {
        // Skip pagination errors
      }
    }
  }

  return allShowtimes;
}

function parseMovieShowtimes(movie: AllocineMovie, movieShowtimes: AllocineShowtimes, date: string): ParsedShowtime[] {
  const showtimes: ParsedShowtime[] = [];
  const baseInfo = extractMovieInfo(movie);

  // Map showtime categories to version labels
  const versionMap: Record<string, string> = {
    original: "VO",
    multiple: "VF",
    original_st: "VOSTFR",
    original_st_sme: "VOSTFR-SME",
    multiple_st: "VF-ST",
    multiple_st_sme: "VF-ST-SME",
    local: "VF",
  };

  for (const [key, versionLabel] of Object.entries(versionMap)) {
    const slots = movieShowtimes[key];
    if (!slots || !Array.isArray(slots)) continue;

    for (const slot of slots) {
      const startDate = slot.startsAt.split("T")[0];
      if (startDate !== date) continue; // Only include showtimes for the requested date

      const startTime = slot.startsAt.split("T")[1]?.substring(0, 5) || "00:00";
      const format = parseFormat(slot.projection, slot.tags);

      showtimes.push({
        ...baseInfo,
        showDate: startDate,
        showTime: startTime,
        showDatetime: `${startDate}T${startTime}`,
        version: versionLabel,
        format,
      });
    }
  }

  return showtimes;
}

function extractMovieInfo(movie: AllocineMovie) {
  const director = movie.credits?.find(
    (c) => c.position?.name === "Réalisateur" || c.position?.name === "Réalisatrice"
  );

  const releaseDate = movie.releases?.[0]?.releaseDate?.date?.split("T")[0] || null;

  return {
    movieTitle: movie.title,
    movieOriginalTitle: movie.originalTitle,
    movieAllocineId: String(movie.internalId),
    moviePosterUrl: movie.poster?.url || null,
    movieGenres: movie.genres?.map((g) => g.translate).join(",") || "",
    movieDurationMin: parseRuntime(movie.runtime),
    movieDirector: director?.person?.name || null,
    movieSynopsis: movie.synopsis || null,
    movieReleaseDate: releaseDate,
    moviePressRating: movie.stats?.pressReview?.score || null,
    movieUserRating: movie.stats?.userRating?.score || null,
  };
}

function parseRuntime(runtime: string | null): number | null {
  if (!runtime) return null;
  const match = runtime.match(/(\d+)h\s*(\d+)?/);
  if (!match) return null;
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  return hours * 60 + minutes;
}

function parseFormat(projection: string[], tags: string[]): string {
  const projStr = projection?.join(",") || "";
  const tagStr = tags?.join(",") || "";
  const combined = `${projStr},${tagStr}`.toUpperCase();

  if (combined.includes("IMAX")) return "IMAX";
  if (combined.includes("DOLBY") || combined.includes("ATMOS")) return "Dolby";
  if (combined.includes("4DX")) return "4DX";
  if (combined.includes("ICE")) return "ICE";
  if (combined.includes("3D")) return "3D";
  return "2D";
}
