import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { requestSeatRefresh, clearSeatRefreshRequest } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

// The site itself can't call Pathé (Node's TLS fingerprint is refused), but when it
// runs next to the scraper — on the VM, with WARP — it can shell out to it and answer
// in a couple of seconds. Elsewhere (Netlify) the request just waits in the queue.
let inFlight = 0;

async function runScraperNow(vistaRef: string, sessionId: number): Promise<boolean> {
  const python = process.env.PATHE_PYTHON;
  if (process.env.PATHE_LOCAL_SCRAPER !== "1" || !python) return false;
  if (inFlight >= 2) return false;

  inFlight++;
  try {
    await execFileAsync(python, ["scripts/pathe-seats.py", "--session", `${vistaRef}/${sessionId}`], {
      cwd: process.cwd(),
      // Usually ~2s with cached credentials; longer if Chrome has to clear the
      // Akamai challenge again.
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  } finally {
    inFlight--;
  }
}

/**
 * "Refresh now" from the site: run the scraper if it's local, otherwise queue the
 * request for the worker (which polls every minute).
 */
export async function POST(request: NextRequest) {
  const vistaRef = request.nextUrl.searchParams.get("vista");
  const sessionId = Number(request.nextUrl.searchParams.get("session"));

  if (!vistaRef || !/^\d+$/.test(vistaRef) || !Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: "vista and session are required" }, { status: 400 });
  }

  const outcome = await requestSeatRefresh(vistaRef, sessionId);
  const headers = { "Cache-Control": "no-store" };

  if (outcome === "queued" || outcome === "already-queued") {
    if (await runScraperNow(vistaRef, sessionId)) {
      await clearSeatRefreshRequest(vistaRef, sessionId);
      return NextResponse.json({ outcome: "refreshed" }, { headers });
    }
  }

  const status = outcome === "unknown-session" ? 404 : outcome === "queue-full" ? 429 : 200;
  return NextResponse.json({ outcome }, { status, headers });
}
