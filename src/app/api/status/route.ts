import { NextResponse } from "next/server";
import { getLastScrapeRun, getStats } from "@/lib/db/queries";

export async function GET() {
  const lastRun = await getLastScrapeRun();
  const stats = await getStats();

  return NextResponse.json({
    lastScrape: lastRun || null,
    stats,
  });
}
