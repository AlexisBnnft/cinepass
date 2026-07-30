import { NextRequest, NextResponse } from "next/server";
import { requestSeatRefresh } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * "Refresh now" from the site. Pathé refuses this host's IP, so the request is
 * queued in the DB and the residential worker (scripts/pathe-seats.py --queue)
 * picks it up within a minute.
 */
export async function POST(request: NextRequest) {
  const vistaRef = request.nextUrl.searchParams.get("vista");
  const sessionId = Number(request.nextUrl.searchParams.get("session"));

  if (!vistaRef || !/^\d+$/.test(vistaRef) || !Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: "vista and session are required" }, { status: 400 });
  }

  const outcome = await requestSeatRefresh(vistaRef, sessionId);
  const status = outcome === "unknown-session" ? 404 : outcome === "queue-full" ? 429 : 200;

  return NextResponse.json({ outcome }, { status, headers: { "Cache-Control": "no-store" } });
}
