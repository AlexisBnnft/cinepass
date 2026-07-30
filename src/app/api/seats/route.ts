import { NextRequest, NextResponse } from "next/server";
import { getSeatSnapshot } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * Latest seat availability for a Pathé session.
 * Snapshots are collected out-of-band (scripts/pathe-seats.py); this only reads them.
 */
export async function GET(request: NextRequest) {
  const vistaRef = request.nextUrl.searchParams.get("vista");
  const sessionId = Number(request.nextUrl.searchParams.get("session"));

  if (!vistaRef || !Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "vista and session are required" }, { status: 400 });
  }

  const snapshot = await getSeatSnapshot(vistaRef, sessionId);
  if (!snapshot) {
    return NextResponse.json({ available: false }, { status: 404 });
  }

  // A row with no layout means the scraper tried and Pathé had no seat map for it.
  if (typeof snapshot.layout !== "string" || snapshot.layout.length === 0) {
    return NextResponse.json({ available: false }, { status: 404 });
  }

  let layout: unknown;
  try {
    layout = JSON.parse(snapshot.layout);
  } catch {
    return NextResponse.json({ available: false }, { status: 404 });
  }

  return NextResponse.json({
    available: true,
    vistaRef,
    sessionId,
    seatsFree: snapshot.seats_free,
    seatsTotal: snapshot.seats_total,
    fetchedAt: snapshot.fetched_at,
    roomName: snapshot.room_name ?? snapshot.auditorium ?? null,
    colCount: snapshot.col_count,
    layout,
    bookingUrl: `https://s.pathe.fr/fr/V${vistaRef}S${sessionId}/booking`,
  }, { headers: { "Cache-Control": "no-store" } });
}
