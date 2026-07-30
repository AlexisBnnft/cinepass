import { NextRequest, NextResponse } from "next/server";
import { discoverPatheSessions } from "@/lib/scraper/pathe";
import { getAllCinemas, upsertPatheSessions, deleteOldPatheData } from "@/lib/db/queries";

export const maxDuration = 300;

/**
 * Refresh the Pathé session ids (booking refs) used by the seat scraper.
 * Cheap and unauthenticated on Pathé's side, so it runs alongside the daily scrape.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SCRAPE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? 3);
  const today = new Date();
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const cinemas = await getAllCinemas();
  const log: string[] = [];

  try {
    const { sessions, errors } = await discoverPatheSessions(cinemas, dates, {
      onProgress: (msg) => log.push(msg),
    });
    await upsertPatheSessions(sessions);
    await deleteOldPatheData(dates[0]);

    return NextResponse.json({
      success: true,
      dates,
      sessionsFound: sessions.length,
      log,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, log }, { status: 500 });
  }
}
