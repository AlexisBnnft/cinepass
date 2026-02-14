// AlloCiné API response types

export interface AllocineResponse {
  error: boolean;
  message: string | null;
  nextDate: string | null;
  results: AllocineMovieResult[];
  pagination: {
    page: number | string;
    totalPages: number;
    itemsPerPage: number;
    totalItems: number;
  };
}

export interface AllocineMovieResult {
  movie: AllocineMovie;
  showtimes: AllocineShowtimes;
}

export interface AllocineMovie {
  internalId: number;
  title: string;
  originalTitle: string;
  poster: { url: string; path: string } | null;
  genres: { id: number; translate: string; tag: string }[];
  runtime: string; // e.g. "1h 57min"
  languages: string[];
  data: {
    productionYear: number;
  };
  stats: {
    userRating: { score: number; count: number };
    pressReview: { score: number; count: number };
  };
  credits: { person: { name: string }; position: { name: string } }[];
  synopsis: string;
  synopsisFull: string;
  releases: { name: string; releaseDate: { date: string } }[];
}

export interface AllocineShowtimes {
  original: AllocineShowtime[];       // VO
  multiple: AllocineShowtime[];       // VF (dubbed)
  original_st: AllocineShowtime[];    // VOSTFR
  original_st_sme: AllocineShowtime[]; // VOSTFR for deaf/hard of hearing
  multiple_st: AllocineShowtime[];
  multiple_st_sme: AllocineShowtime[];
  [key: string]: AllocineShowtime[];
}

export interface AllocineShowtime {
  internalId: number;
  startsAt: string; // ISO 8601: "2026-02-07T13:45:00"
  projection: string[]; // e.g. ["DIGITAL"], ["IMAX"], ["DOLBY_ATMOS"]
  diffusionVersion: string; // "ORIGINAL" | "LOCAL"
  tags: string[];
  data: {
    ticketing: { urls: string[]; type: string; provider: string }[];
  };
}

// Normalized types for our DB
export interface ParsedShowtime {
  movieTitle: string;
  movieOriginalTitle: string;
  movieAllocineId: string;
  moviePosterUrl: string | null;
  movieGenres: string;
  movieDurationMin: number | null;
  movieDirector: string | null;
  movieSynopsis: string | null;
  movieReleaseDate: string | null;
  moviePressRating: number | null;
  movieUserRating: number | null;
  showDate: string;     // YYYY-MM-DD
  showTime: string;     // HH:MM
  showDatetime: string; // YYYY-MM-DDTHH:MM
  version: string;      // VF, VO, VOSTFR
  format: string;       // 2D, IMAX, Dolby, 4DX
}

export interface ScrapeResult {
  success: boolean;
  cinemaCode: string;
  date: string;
  showtimesCount: number;
  error?: string;
}
