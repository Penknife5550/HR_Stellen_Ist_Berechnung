/**
 * POST /api/notifications/dispatch
 *
 * Verarbeitet faellige Notification-Retries.
 * Kann von N8N (Cron-Workflow) oder einem externen Scheduler alle paar
 * Minuten aufgerufen werden.
 *
 * Auth: Header "x-dispatch-key" muss mit ENV NOTIFICATION_DISPATCH_KEY
 * uebereinstimmen. Ohne gesetztes ENV ist der Endpoint deaktiviert.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { dispatchPending } from "@/lib/notifications";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  const expected = process.env.NOTIFICATION_DISPATCH_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "Dispatch-Endpoint nicht konfiguriert (NOTIFICATION_DISPATCH_KEY fehlt)." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-dispatch-key") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  try {
    const result = await dispatchPending();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Dispatch-Fehler:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Interner Fehler." }, { status: 500 });
  }
}
