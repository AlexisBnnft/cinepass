"use client";

import { useState } from "react";

export function ReloadButton({ onComplete }: { onComplete: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleReload() {
    setIsLoading(true);
    setProgress("Chargement des séances...");

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();

      if (res.status === 409) {
        setProgress("Scrape déjà en cours...");
        return;
      }

      if (data.success) {
        setProgress(
          `${data.stats.moviesFound} films, ${data.stats.showtimesFound} séances`
        );
        onComplete();
      } else {
        setProgress("Erreur: " + (data.error || "inconnue"));
      }
    } catch {
      setProgress("Erreur réseau");
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(""), 5000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {progress && (
        <span className="text-sm text-gray-400">{progress}</span>
      )}
      <button
        onClick={handleReload}
        disabled={isLoading}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Fetch cette semaine
          </>
        )}
      </button>
    </div>
  );
}
