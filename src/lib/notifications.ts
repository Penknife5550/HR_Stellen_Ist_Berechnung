/**
 * Ausgehende Notifications an N8N / externe Systeme.
 *
 * - notify(event, payload): fanned-out pro abonniertem Target, legt Log an
 *   und stoesst sofortigen Zustellversuch an. Fehler sind nicht blocking.
 * - dispatchPending(): verarbeitet faellige Retries (atomares Claiming,
 *   damit parallele Laeufe keine Duplikate senden). Wird vom Cron-Endpoint
 *   /api/notifications/dispatch aufgerufen.
 *
 * Events: sync.completed, sync.failed, lehrer.created, hauptdeputat.changed
 */

import crypto from "crypto";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { and, eq, lte, or, isNull, sql } from "drizzle-orm";
import { validateWebhookUrl } from "@/lib/urlSafety";

export const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MIN = [1, 5, 15];
const REQUEST_TIMEOUT_MS = 10_000;
/** Max. parallele Fetches im dispatchPending-Lauf */
const DISPATCH_CONCURRENCY = 5;

export type EventType =
  | "sync.completed"
  | "sync.failed"
  | "lehrer.created"
  | "hauptdeputat.changed";

export const ALL_EVENT_TYPES: EventType[] = [
  "sync.completed",
  "sync.failed",
  "lehrer.created",
  "hauptdeputat.changed",
];

export const EVENT_LABELS: Record<EventType, string> = {
  "sync.completed": "Sync erfolgreich abgeschlossen",
  "sync.failed": "Sync fehlgeschlagen",
  "lehrer.created": "Neuer Lehrer angelegt",
  "hauptdeputat.changed": "Hauptdeputat geaendert",
};

/**
 * Pro abonniertem Target einen Log-Eintrag anlegen und sofortigen Versand anstossen.
 * Fehler beim Versand sind nicht blocking fuer den Caller.
 */
export async function notify(event: EventType, payload: Record<string, unknown>): Promise<void> {
  try {
    const targets = await db
      .select()
      .from(schema.notificationTargets)
      .where(eq(schema.notificationTargets.aktiv, true));

    const matching = targets.filter((t) => {
      const events = Array.isArray(t.eventTypes) ? (t.eventTypes as string[]) : [];
      return events.includes(event);
    });

    for (const target of matching) {
      const [logEntry] = await db
        .insert(schema.notificationLog)
        .values({
          targetId: target.id,
          eventType: event,
          payload: payload as object,
          status: "pending",
        })
        .returning({ id: schema.notificationLog.id });

      void tryDispatch(logEntry.id).catch((err) => {
        console.error(`notify: dispatch fehlgeschlagen (log ${logEntry.id}):`, err);
      });
    }
  } catch (err) {
    console.error(`notify(${event}) Fehler:`, err instanceof Error ? err.message : err);
  }
}

/**
 * Verarbeitet alle faelligen Log-Eintraege in kleinen parallelen Batches.
 */
export async function dispatchPending(): Promise<{ verarbeitet: number; erfolgreich: number; fehler: number }> {
  const now = new Date();
  const pending = await db
    .select({ id: schema.notificationLog.id })
    .from(schema.notificationLog)
    .where(
      and(
        eq(schema.notificationLog.status, "pending"),
        or(
          isNull(schema.notificationLog.nextRetryAt),
          lte(schema.notificationLog.nextRetryAt, now)
        )
      )
    )
    .limit(100);

  let erfolgreich = 0;
  let fehler = 0;
  // In Chunks mit Concurrency-Limit verarbeiten
  for (let i = 0; i < pending.length; i += DISPATCH_CONCURRENCY) {
    const chunk = pending.slice(i, i + DISPATCH_CONCURRENCY);
    const results = await Promise.all(chunk.map((p) => tryDispatch(p.id)));
    for (const r of results) {
      if (r === "success") erfolgreich++;
      else if (r === "failed") fehler++;
    }
  }

  return { verarbeitet: pending.length, erfolgreich, fehler };
}

type DispatchResult = "success" | "failed" | "skipped";

/**
 * Atomarer Zustellversuch: claimt den Log-Eintrag, macht den Request,
 * schreibt Ergebnis. Gibt "skipped" zurueck, wenn ein anderer Worker
 * den Eintrag zuerst geclaimt hat.
 */
async function tryDispatch(logId: number): Promise<DispatchResult> {
  // Atomares Claiming: status pending -> pending (mit Attempt-Bumping)
  // Wir benutzen ein "sending"-Fenster via nextRetryAt=NULL + lastAttemptAt=NOW
  // und setzen status erst am Ende.
  // Drizzle: UPDATE ... WHERE id=? AND status='pending' AND (nextRetryAt IS NULL OR <= NOW) RETURNING *
  const now = new Date();
  const claimed = await db
    .update(schema.notificationLog)
    .set({
      lastAttemptAt: now,
      attemptCount: sql`${schema.notificationLog.attemptCount} + 1`,
    })
    .where(
      and(
        eq(schema.notificationLog.id, logId),
        eq(schema.notificationLog.status, "pending"),
        or(
          isNull(schema.notificationLog.nextRetryAt),
          lte(schema.notificationLog.nextRetryAt, now)
        )
      )
    )
    .returning();

  if (claimed.length === 0) {
    return "skipped"; // von anderem Worker geclaimt oder Status geaendert
  }
  const entry = claimed[0];

  if (!entry.targetId) {
    await db
      .update(schema.notificationLog)
      .set({ status: "failed", lastError: "Target geloescht", nextRetryAt: null })
      .where(eq(schema.notificationLog.id, logId));
    return "failed";
  }

  const [target] = await db
    .select()
    .from(schema.notificationTargets)
    .where(eq(schema.notificationTargets.id, entry.targetId))
    .limit(1);

  if (!target || !target.aktiv) {
    await db
      .update(schema.notificationLog)
      .set({ status: "failed", lastError: "Target inaktiv/geloescht", nextRetryAt: null })
      .where(eq(schema.notificationLog.id, logId));
    return "failed";
  }

  // URL-Sicherheit pruefen (SSRF-Schutz)
  const urlCheck = await validateWebhookUrl(target.url);
  if (!urlCheck.ok) {
    await db
      .update(schema.notificationLog)
      .set({ status: "failed", lastError: `URL abgelehnt: ${urlCheck.reason}`, nextRetryAt: null })
      .where(eq(schema.notificationLog.id, logId));
    return "failed";
  }

  const body = JSON.stringify({
    event: entry.eventType,
    timestamp: new Date().toISOString(),
    payload: entry.payload,
  });

  const headers = buildHeaders(entry.eventType, body, target);

  let httpStatus: number | null = null;
  let errorMsg: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(target.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "error", // keine Redirects folgen (SSRF-Schutz)
    });
    clearTimeout(timeout);
    httpStatus = response.status;
    if (response.ok) {
      success = true;
    } else {
      const text = await response.text().catch(() => "");
      errorMsg = `HTTP ${response.status}: ${text}`.slice(0, 500);
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  const attemptNum = entry.attemptCount; // bereits durch Claim inkrementiert
  if (success) {
    await db
      .update(schema.notificationLog)
      .set({
        status: "success",
        httpStatus,
        nextRetryAt: null,
        lastError: null,
      })
      .where(eq(schema.notificationLog.id, logId));
    return "success";
  }

  if (attemptNum >= MAX_ATTEMPTS) {
    await db
      .update(schema.notificationLog)
      .set({
        status: "failed",
        httpStatus,
        lastError: errorMsg,
        nextRetryAt: null,
      })
      .where(eq(schema.notificationLog.id, logId));
    return "failed";
  }

  const delayMin = RETRY_DELAYS_MIN[attemptNum - 1] ?? 15;
  const nextRetryAt = new Date(Date.now() + delayMin * 60_000);
  await db
    .update(schema.notificationLog)
    .set({
      status: "pending",
      httpStatus,
      lastError: errorMsg,
      nextRetryAt,
    })
    .where(eq(schema.notificationLog.id, logId));
  return "failed";
}

/**
 * Baut HTTP-Header mit optionaler HMAC-Signatur.
 * Custom-Header werden gegen CRLF-Injection gefiltert.
 */
function buildHeaders(
  eventType: string,
  body: string,
  target: { secret: string | null; headers: unknown }
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "CREDO-Stellenberechnung/1.0",
    "X-Event-Type": eventType,
  };

  if (target.headers && typeof target.headers === "object" && !Array.isArray(target.headers)) {
    for (const [k, v] of Object.entries(target.headers as Record<string, unknown>)) {
      if (typeof v !== "string") continue;
      if (!/^[A-Za-z0-9_-]+$/.test(k)) continue; // Header-Name safe
      // CRLF strippen (Header-Injection-Schutz)
      const clean = v.replace(/[\r\n]/g, "").slice(0, 1000);
      headers[k] = clean;
    }
  }

  if (target.secret) {
    const signature = crypto.createHmac("sha256", target.secret).update(body).digest("hex");
    headers["X-Signature"] = `sha256=${signature}`;
  }
  return headers;
}

/**
 * Test-Button in Admin-UI. Sendet synchron einen Test-Payload (ohne Log).
 */
export async function sendTestNotification(
  targetId: number
): Promise<{ success: boolean; httpStatus: number | null; error: string | null; durationMs: number }> {
  const [target] = await db
    .select()
    .from(schema.notificationTargets)
    .where(eq(schema.notificationTargets.id, targetId))
    .limit(1);

  if (!target) {
    return { success: false, httpStatus: null, error: "Target nicht gefunden", durationMs: 0 };
  }

  const urlCheck = await validateWebhookUrl(target.url);
  if (!urlCheck.ok) {
    return { success: false, httpStatus: null, error: `URL abgelehnt: ${urlCheck.reason}`, durationMs: 0 };
  }

  const body = JSON.stringify({
    event: "test.ping",
    timestamp: new Date().toISOString(),
    payload: {
      message: "Test-Benachrichtigung aus CREDO Stellenberechnung",
      targetName: target.name,
    },
  });
  const headers = buildHeaders("test.ping", body, target);

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(target.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "error",
    });
    clearTimeout(timeout);
    const durationMs = Date.now() - start;
    if (response.ok) {
      return { success: true, httpStatus: response.status, error: null, durationMs };
    }
    const text = await response.text().catch(() => "");
    return {
      success: false,
      httpStatus: response.status,
      error: `HTTP ${response.status}: ${text.slice(0, 300)}`,
      durationMs,
    };
  } catch (err) {
    return {
      success: false,
      httpStatus: null,
      error: err instanceof Error ? err.message : "Unbekannter Fehler",
      durationMs: Date.now() - start,
    };
  }
}
