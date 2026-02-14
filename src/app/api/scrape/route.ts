import { NextRequest, NextResponse } from "next/server";
import { scrapeAll } from "@/lib/scraper/orchestrator";
import { getActiveScrapeRun } from "@/lib/db/queries";

export const maxDuration = 300; // 5 minutes max

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.SCRAPE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const active = await getActiveScrapeRun();
  if (active) {
    return NextResponse.json(
      { error: "Scrape already in progress", runId: active.id },
      { status: 409 }
    );
  }

  try {
    const { runId, stats } = await scrapeAll(7);
    return NextResponse.json({
      success: true,
      runId,
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
