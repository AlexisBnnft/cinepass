"use client";

import { formatDuration, formatArrondissement } from "@/lib/utils";

interface Showtime {
  show_time: string;
  version: string;
  format: string;
}

interface Cinema {
  cinema_name: string;
  arrondissement: number;
  showtimes: Showtime[];
}

interface Movie {
  id: number;
  title: string;
  title_original: string | null;
  poster_url: string | null;
  genres: string | null;
  duration_min: number | null;
  director: string | null;
  synopsis: string | null;
  user_rating: number | null;
  press_rating: number | null;
  cinema_count: number;
  cinemas: Cinema[];
}

interface MovieDetailModalProps {
  movie: Movie;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export function MovieDetailModal({ movie, onClose, isFavorite, onToggleFavorite }: MovieDetailModalProps) {
  const genres = movie.genres?.split(",") || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-800/80 hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex gap-4 p-5">
          {movie.poster_url && (
            <div className="w-24 h-36 rounded-lg overflow-hidden bg-gray-800 shrink-0">
              <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 pr-8">
              <h2 className="text-lg font-semibold">{movie.title}</h2>
              <button
                onClick={onToggleFavorite}
                className={`shrink-0 p-1.5 rounded-full transition-colors ${
                  isFavorite
                    ? "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
                aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
            {movie.title_original && movie.title_original !== movie.title && (
              <p className="text-xs text-gray-500 mt-0.5">{movie.title_original}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {genres.map((g) => (
                <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300">
                  {g.trim()}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {movie.duration_min && <span>{formatDuration(movie.duration_min)}</span>}
              {movie.director && <span>{movie.director}</span>}
            </div>
            {(movie.user_rating || movie.press_rating) && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                {movie.user_rating ? <span>Spectateurs {movie.user_rating.toFixed(1)}/5</span> : null}
                {movie.press_rating ? <span>Presse {movie.press_rating.toFixed(1)}/5</span> : null}
              </div>
            )}
          </div>
        </div>

        {/* Synopsis */}
        {movie.synopsis && (
          <div className="px-5 pb-4">
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-4">{movie.synopsis}</p>
          </div>
        )}

        {/* Showtimes by cinema */}
        <div className="border-t border-gray-800">
          <div className="px-5 py-3">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Séances ({movie.cinema_count} cinéma{movie.cinema_count > 1 ? "s" : ""})
            </h3>
            <div className="space-y-4">
              {movie.cinemas.map((cinema) => (
                <div key={cinema.cinema_name}>
                  <div className="text-xs font-medium text-white mb-1.5">
                    {cinema.cinema_name}{" "}
                    <span className="text-gray-500 font-normal">
                      ({formatArrondissement(cinema.arrondissement)})
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {cinema.showtimes.map((st, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-800 text-gray-200 border border-gray-700"
                      >
                        {st.show_time}
                        {st.version !== "VF" && (
                          <span className="text-[10px] text-indigo-400 ml-1">{st.version}</span>
                        )}
                        {st.format !== "2D" && (
                          <span className="text-[10px] text-amber-400 ml-1">{st.format}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
