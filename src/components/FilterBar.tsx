"use client";

import { DayFilter } from "./DayFilter";
import { TimeRangeFilter } from "./TimeRangeFilter";
import { GenreFilter } from "./GenreFilter";

interface FilterBarProps {
  dates: { date: string; dayLabel: string; isToday: boolean }[];
  genres: string[];
  activeDate: string;
  activeGenres: string[];
  timeMin: string;
  timeMax: string;
  search: string;
  showFavoritesOnly: boolean;
  favoritesCount: number;
  onDateChange: (date: string) => void;
  onGenresChange: (genres: string[]) => void;
  onTimeChange: (min: string, max: string) => void;
  onSearchChange: (search: string) => void;
  onToggleFavoritesOnly: () => void;
}

export function FilterBar({
  dates,
  genres,
  activeDate,
  activeGenres,
  timeMin,
  timeMax,
  search,
  showFavoritesOnly,
  favoritesCount,
  onDateChange,
  onGenresChange,
  onTimeChange,
  onSearchChange,
  onToggleFavoritesOnly,
}: FilterBarProps) {
  return (
    <div className="space-y-3 mb-6">
      <DayFilter dates={dates} activeDate={activeDate} onChange={onDateChange} />
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <TimeRangeFilter timeMin={timeMin} timeMax={timeMax} onChange={onTimeChange} />
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onToggleFavoritesOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              showFavoritesOnly
                ? "bg-indigo-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={showFavoritesOnly ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Favoris{favoritesCount > 0 ? ` (${favoritesCount})` : ""}
          </button>
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un film..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48"
            />
          </div>
        </div>
      </div>
      <GenreFilter genres={genres} activeGenres={activeGenres} onChange={onGenresChange} />
    </div>
  );
}
