"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { formatDuration, formatArrondissement } from "@/lib/utils";

const CinemaMap = dynamic(() => import("./CinemaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center">
      <span className="text-sm text-gray-400">Chargement de la carte...</span>
    </div>
  ),
});

interface Showtime {
  show_time: string;
  version: string;
  format: string;
}

interface Cinema {
  cinema_name: string;
  arrondissement: number;
  latitude: number | null;
  longitude: number | null;
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
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-200/80 dark:bg-gray-800/80 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex gap-4 p-5">
          {movie.poster_url && (
            <div className="w-24 h-36 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
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
                    ? "bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-600/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
            {movie.title_original && movie.title_original !== movie.title && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{movie.title_original}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {genres.map((g) => (
                <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300">
                  {g.trim()}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {movie.duration_min && <span>{formatDuration(movie.duration_min)}</span>}
              {movie.director && <span>{movie.director}</span>}
            </div>
            {(movie.user_rating || movie.press_rating) && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {movie.user_rating ? <span>Spectateurs {movie.user_rating.toFixed(1)}/5</span> : null}
                {movie.press_rating ? <span>Presse {movie.press_rating.toFixed(1)}/5</span> : null}
              </div>
            )}
          </div>
        </div>

        {/* Synopsis */}
        {movie.synopsis && (
          <div className="px-5 pb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-4">{movie.synopsis}</p>
          </div>
        )}

        {/* View toggle + content */}
        <div className="border-t border-gray-200 dark:border-gray-800">
          <div className="px-5 py-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Séances ({movie.cinema_count} cinéma{movie.cinema_count > 1 ? "s" : ""})
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Liste
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === "map"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Carte
                </button>
              </div>
            </div>

            {viewMode === "list" ? (
              <div className="space-y-4">
                {movie.cinemas.map((cinema) => (
                  <div key={cinema.cinema_name}>
                    <div className="text-xs font-medium text-gray-900 dark:text-white mb-1.5">
                      {cinema.cinema_name}{" "}
                      <span className="text-gray-400 dark:text-gray-500 font-normal">
                        ({formatArrondissement(cinema.arrondissement)})
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {cinema.showtimes.map((st, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
                        >
                          {st.show_time}
                          {st.version !== "VF" && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 ml-1">{st.version}</span>
                          )}
                          {st.format !== "2D" && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">{st.format}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[400px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <CinemaMap cinemas={movie.cinemas} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
