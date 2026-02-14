"use client";

interface GenreFilterProps {
  genres: string[];
  activeGenres: string[];
  onChange: (genres: string[]) => void;
}

export function GenreFilter({ genres, activeGenres, onChange }: GenreFilterProps) {
  function toggleGenre(genre: string) {
    if (activeGenres.includes(genre)) {
      onChange(activeGenres.filter((g) => g !== genre));
    } else {
      onChange([...activeGenres, genre]);
    }
  }

  if (genres.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {genres.map((genre) => {
        const isActive = activeGenres.includes(genre);
        return (
          <button
            key={genre}
            onClick={() => toggleGenre(genre)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              isActive
                ? "bg-indigo-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}
