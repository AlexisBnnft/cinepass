"use client";

import { formatDuration, formatArrondissement } from "@/lib/utils";

interface Cinema {
  cinema_name: string;
  arrondissement: number;
  latitude: number | null;
  longitude: number | null;
  showtimes: {
    show_time: string;
    version: string;
    format: string;
  }[];
}

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    poster_url: string | null;
    genres: string | null;
    duration_min: number | null;
    user_rating: number | null;
    press_rating: number | null;
    cinema_count: number;
    cinemas: Cinema[];
  };
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}

export function MovieCard({ movie, isFavorite, onToggleFavorite, onClick }: MovieCardProps) {
  const genres = movie.genres?.split(",").slice(0, 3) || [];

  return (
    <div
      onClick={onClick}
      className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer group"
    >
      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={`absolute top-3 right-3 p-1.5 rounded-full transition-colors z-10 ${
          isFavorite
            ? "bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-600/30"
            : "bg-gray-200/80 dark:bg-gray-800/80 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
        aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      <div className="flex gap-4 p-4">
        {/* Poster */}
        <div className="w-20 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
          {movie.poster_url ? (
            <img
              src={movie.poster_url}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs">
              No img
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate pr-8">
            {movie.title}
          </h3>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {genres.map((g) => (
              <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {g.trim()}
              </span>
            ))}
            {movie.duration_min && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {formatDuration(movie.duration_min)}
              </span>
            )}
          </div>

          {(movie.user_rating || movie.press_rating) && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {movie.user_rating ? (
                <span>Spectateurs {movie.user_rating.toFixed(1)}/5</span>
              ) : null}
              {movie.press_rating ? (
                <span>Presse {movie.press_rating.toFixed(1)}/5</span>
              ) : null}
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {movie.cinema_count} cinéma{movie.cinema_count > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Showtimes preview */}
      <div className="px-4 pb-3 space-y-1.5">
        {movie.cinemas.slice(0, 3).map((cinema) => (
          <div key={cinema.cinema_name} className="flex items-start gap-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 w-28 shrink-0 truncate pt-0.5">
              {cinema.cinema_name} ({formatArrondissement(cinema.arrondissement)})
            </span>
            <div className="flex gap-1 flex-wrap">
              {cinema.showtimes.slice(0, 5).map((st, i) => (
                <span
                  key={i}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  {st.show_time}
                  {st.version !== "VF" && (
                    <span className="text-[9px] text-indigo-600 dark:text-indigo-400 ml-0.5">{st.version}</span>
                  )}
                </span>
              ))}
              {cinema.showtimes.length > 5 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 pt-0.5">+{cinema.showtimes.length - 5}</span>
              )}
            </div>
          </div>
        ))}
        {movie.cinemas.length > 3 && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            +{movie.cinemas.length - 3} cinéma{movie.cinemas.length - 3 > 1 ? "s" : ""}...
          </span>
        )}
      </div>
    </div>
  );
}
