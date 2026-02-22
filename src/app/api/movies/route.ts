import { NextRequest, NextResponse } from "next/server";
import { getMoviesWithFilters, getShowtimesForMovie, getDistinctGenres } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const genres = searchParams.getAll("genre");
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");
  const search = searchParams.get("q");

  const movies = await getMoviesWithFilters({
    date,
    genres: genres.length > 0 ? genres : undefined,
    timeMin,
    timeMax,
    search,
  });

  // For each movie, also get its showtimes for this date
  const moviesWithShowtimes = await Promise.all(
    movies.map(async (movie) => {
      const showtimes = await getShowtimesForMovie(movie.id, date);
      // Group showtimes by cinema
      const cinemaMap = new Map<number, { cinema_name: string; arrondissement: number; latitude: number | null; longitude: number | null; showtimes: typeof showtimes }>();
      for (const st of showtimes) {
        if (!cinemaMap.has(st.cinema_id)) {
          cinemaMap.set(st.cinema_id, {
            cinema_name: st.cinema_name,
            arrondissement: st.arrondissement,
            latitude: st.latitude,
            longitude: st.longitude,
            showtimes: [],
          });
        }
        cinemaMap.get(st.cinema_id)!.showtimes.push(st);
      }
      return {
        ...movie,
        cinemas: Array.from(cinemaMap.values()),
      };
    })
  );

  const availableGenres = await getDistinctGenres();

  return NextResponse.json({
    movies: moviesWithShowtimes,
    genres: availableGenres,
    date,
  });
}
