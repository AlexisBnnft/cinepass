"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { MovieCard } from "@/components/MovieCard";
import { MovieDetailModal } from "@/components/MovieDetailModal";

import { useFavorites } from "@/lib/useFavorites";

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

interface StatusData {
  lastScrape: { completed_at: string; status: string } | null;
  stats: { movieCount: number; showtimeCount: number; cinemaCount: number };
}

function getWeekDates(): { date: string; dayLabel: string; isToday: boolean }[] {
  const days: { date: string; dayLabel: string; isToday: boolean }[] = [];
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const today = new Date().toISOString().split("T")[0];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      dayLabel: dayNames[d.getDay()],
      isToday: dateStr === today,
    });
  }
  return days;
}

export default function HomePage() {
  const dates = getWeekDates();
  const [activeDate, setActiveDate] = useState(dates[0].date);
  const [timeMin, setTimeMin] = useState("");
  const [timeMax, setTimeMax] = useState("");
  const [activeGenres, setActiveGenres] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  const fetchMovies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("date", activeDate);
      if (timeMin) params.set("timeMin", timeMin);
      if (timeMax) params.set("timeMax", timeMax);
      activeGenres.forEach((g) => params.append("genre", g));
      if (search) params.set("q", search);

      const res = await fetch(`/api/movies?${params.toString()}`);
      const data = await res.json();
      setMovies(data.movies || []);
      setGenres(data.genres || []);
    } catch {
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [activeDate, timeMin, timeMax, activeGenres, search]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      setStatus(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  function handleTimeChange(min: string, max: string) {
    setTimeMin(min);
    setTimeMax(max);
  }

const displayedMovies = showFavoritesOnly
    ? movies.filter((m) => isFavorite(m.id))
    : movies;

  return (
    <main className="min-h-screen">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Status */}
        {status?.stats.showtimeCount ? (
          <div className="text-xs text-gray-500 mb-6">
            {status.stats.movieCount} films, {status.stats.showtimeCount} séances
            {status.lastScrape?.completed_at && (
              <> &middot; Maj{" "}
                {new Date(status.lastScrape.completed_at + "Z").toLocaleString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}
              </>
            )}
          </div>
        ) : null}

        {/* Filters */}
        <FilterBar
          dates={dates}
          genres={genres}
          activeDate={activeDate}
          activeGenres={activeGenres}
          timeMin={timeMin}
          timeMax={timeMax}
          search={search}
          showFavoritesOnly={showFavoritesOnly}
          favoritesCount={favorites.size}
          onDateChange={setActiveDate}
          onGenresChange={setActiveGenres}
          onTimeChange={handleTimeChange}
          onSearchChange={setSearch}
          onToggleFavoritesOnly={() => setShowFavoritesOnly((v) => !v)}
        />

        {/* Movie List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl h-36 animate-pulse" />
            ))}
          </div>
        ) : displayedMovies.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">Aucun film trouvé</p>
            <p className="text-sm mt-1">
              {showFavoritesOnly
                ? "Aucun favori pour cette sélection."
                : "Essayez de modifier vos filtres."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-2">
              {displayedMovies.length} film{displayedMovies.length > 1 ? "s" : ""}
              {showFavoritesOnly && " (favoris)"}
            </p>
            {displayedMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                isFavorite={isFavorite(movie.id)}
                onToggleFavorite={() => toggleFavorite(movie.id)}
                onClick={() => setSelectedMovie(movie)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedMovie && (
        <MovieDetailModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          isFavorite={isFavorite(selectedMovie.id)}
          onToggleFavorite={() => toggleFavorite(selectedMovie.id)}
        />
      )}
    </main>
  );
}
