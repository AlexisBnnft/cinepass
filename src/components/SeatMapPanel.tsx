"use client";

import { useEffect, useState } from "react";

interface SeatLayout {
  cols: number;
  rows: { name: string; cells: string }[];
}

interface SeatsResponse {
  available: boolean;
  seatsFree: number | null;
  seatsTotal: number | null;
  fetchedAt: string | null;
  roomName: string | null;
  layout: SeatLayout | null;
  bookingUrl: string;
}

interface SeatMapPanelProps {
  vistaRef: string;
  sessionId: number;
  label: string;
  onClose: () => void;
}

/** "il y a 12 min" — snapshots are periodic, so freshness is always shown. */
export function formatFreshness(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null;
  const then = new Date(fetchedAt);
  if (Number.isNaN(then.getTime())) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

const PMR = new Set(["p", "P"]);

function seatClass(char: string): string {
  if (char === ".") return "opacity-0";
  const free = char === char.toLowerCase();
  if (PMR.has(char)) {
    return free
      ? "bg-sky-400 dark:bg-sky-500"
      : "bg-gray-200 dark:bg-gray-700";
  }
  return free
    ? "bg-indigo-500 dark:bg-indigo-400"
    : "bg-gray-200 dark:bg-gray-700";
}

export function SeatMapPanel({ vistaRef, sessionId, label, onClose }: SeatMapPanelProps) {
  const [data, setData] = useState<SeatsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [refresh, setRefresh] = useState<"idle" | "waiting" | "done" | "unavailable">("idle");

  // Remounted per session (keyed by the caller), so "loading" is the initial state.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/seats?vista=${vistaRef}&session=${sessionId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState("empty");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const json: SeatsResponse = await res.json();
        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [vistaRef, sessionId]);

  /**
   * The site can't call Pathé itself, so this queues the request and waits for the
   * scraper (which polls every minute) to write a newer snapshot.
   */
  async function askRefresh() {
    if (refresh === "waiting") return;
    const before = data?.fetchedAt ?? null;
    setRefresh("waiting");

    try {
      const res = await fetch(`/api/seats/refresh?vista=${vistaRef}&session=${sessionId}`, {
        method: "POST",
      });
      const { outcome } = (await res.json()) as { outcome?: string };
      if (outcome === "unknown-session" || outcome === "queue-full") {
        setRefresh("unavailable");
        return;
      }
    } catch {
      setRefresh("unavailable");
      return;
    }

    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const res = await fetch(`/api/seats?vista=${vistaRef}&session=${sessionId}`);
        if (!res.ok) continue;
        const json: SeatsResponse = await res.json();
        if (json.fetchedAt && json.fetchedAt !== before) {
          setData(json);
          setState("ready");
          setRefresh("done");
          return;
        }
      } catch {
        // keep polling
      }
    }
    setRefresh("unavailable");
  }

  const fill =
    data?.seatsTotal && data.seatsFree !== null
      ? Math.round(((data.seatsTotal - data.seatsFree) / data.seatsTotal) * 100)
      : null;

  return (
    <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-900 dark:text-white">
            {label}
            {data?.roomName && (
              <span className="text-gray-400 dark:text-gray-500 font-normal"> · {data.roomName}</span>
            )}
          </div>
          {state === "ready" && data && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {data.seatsFree} places libres sur {data.seatsTotal}
              {fill !== null && ` · ${fill}% rempli`}
              {data.fetchedAt && ` · ${formatFreshness(data.fetchedAt)}`}
              {refresh === "waiting" && (
                <span className="text-indigo-600 dark:text-indigo-400"> · mise à jour en cours…</span>
              )}
              {refresh === "unavailable" && (
                <span className="text-amber-600 dark:text-amber-400"> · mise à jour indisponible</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {state === "ready" && (
            <button
              onClick={askRefresh}
              disabled={refresh === "waiting"}
              title="Relever les places maintenant (~1 min)"
              className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors disabled:hover:bg-transparent"
              aria-label="Rafraîchir les places"
            >
              <svg
                className={`w-3.5 h-3.5 ${refresh === "waiting" ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 9A8 8 0 006.3 5.7L4 8m0 7a8 8 0 0013.7 3.3L20 16" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Fermer le plan de salle"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {state === "loading" && (
        <div className="h-24 flex items-center justify-center text-[11px] text-gray-400">
          Chargement du plan…
        </div>
      )}

      {state === "empty" && (
        <div className="py-4 text-[11px] text-gray-500 dark:text-gray-400">
          Pas encore de relevé pour cette séance.
        </div>
      )}

      {state === "error" && (
        <div className="py-4 text-[11px] text-gray-500 dark:text-gray-400">
          Plan indisponible pour le moment.
        </div>
      )}

      {state === "ready" && data?.layout && (
        <>
          <div className="mt-3 overflow-x-auto">
            {/* Cap the seat size so a 30-seat room doesn't render giant blocks. */}
            <div
              className="min-w-[240px] mx-auto space-y-[3px]"
              style={{ maxWidth: `${data.layout.cols * 22 + 24}px` }}
            >
              {data.layout.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-1.5">
                  <span className="w-3 shrink-0 text-[8px] text-gray-400 dark:text-gray-500 text-right leading-none">
                    {row.name}
                  </span>
                  <div
                    className="grid gap-[3px] flex-1"
                    style={{ gridTemplateColumns: `repeat(${data.layout!.cols}, minmax(0, 1fr))` }}
                  >
                    {Array.from(row.cells).map((char, colIndex) => (
                      <div
                        key={colIndex}
                        className={`aspect-square rounded-[2px] ${seatClass(char)}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="mx-auto min-w-[240px]"
              style={{ maxWidth: `${data.layout.cols * 22 + 24}px` }}
            >
              <div className="mt-2 ml-[18px] h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <div className="text-center text-[8px] text-gray-400 dark:text-gray-500 mt-0.5">ÉCRAN</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-[2px] bg-indigo-500 dark:bg-indigo-400" /> libre
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-[2px] bg-gray-200 dark:bg-gray-700" /> occupé
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-[2px] bg-sky-400 dark:bg-sky-500" /> PMR
              </span>
            </div>
            <a
              href={data.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Réserver sur Pathé →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
