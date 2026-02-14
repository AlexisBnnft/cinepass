"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "cinepass-favorites";

function readFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function writeFavorites(ids: Set<number>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const toggleFavorite = useCallback((movieId: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) {
        next.delete(movieId);
      } else {
        next.add(movieId);
      }
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (movieId: number) => favorites.has(movieId),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
