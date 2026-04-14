"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { generateApiKey } from "@/lib/webhookAuth";
import { sendTestNotification, ALL_EVENT_TYPES } from "@/lib/notifications";
import { validateWebhookUrl } from "@/lib/urlSafety";
import { safeFormNumber, safeFormString } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

// ============================================================
// Eingehende Webhooks (webhook_configs)
// ============================================================

export async function listWebhookConfigs() {
  await requireAdmin();
  return db
    .select({
      id: schema.webhookConfigs.id,
      name: schema.webhookConfigs.name,
      endpointTyp: schema.webhookConfigs.endpointTyp,
      apiKeyPrefix: schema.webhookConfigs.apiKeyPrefix,
      aktiv: schema.webhookConfigs.aktiv,
      beschreibung: schema.webhookConfigs.beschreibung,
      lastUsedAt: schema.webhookConfigs.lastUsedAt,
      erstelltVon: schema.webhookConfigs.erstelltVon,
      createdAt: schema.webhookConfigs.createdAt,
    })
    .from(schema.webhookConfigs)
    .orderBy(desc(schema.webhookConfigs.createdAt));
}

const webhookConfigSchema = z.object({
  name: z.string().min(2, "Name muss mind. 2 Zeichen haben.").max(100),
  endpointTyp: z.string().min(1).max(30),
  beschreibung: z.string().max(1000).optional(),
});

export async function createWebhookConfigAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = webhookConfigSchema.safeParse({
    name: safeFormString(formData, "name", 100).trim(),
    endpointTyp: safeFormString(formData, "endpointTyp", 30).trim() || "sync",
    beschreibung: safeFormString(formData, "beschreibung", 1000).trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const { key, prefix, hash } = await generateApiKey();

  try {
    const [inserted] = await db
      .insert(schema.webhookConfigs)
      .values({
        name: parsed.data.name,
        endpointTyp: parsed.data.endpointTyp,
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
        beschreibung: parsed.data.beschreibung ?? null,
        erstelltVon: session.name,
      })
      .returning();

    await writeAuditLog("webhook_configs", inserted.id, "INSERT", null, {
      name: parsed.data.name,
      endpointTyp: parsed.data.endpointTyp,
    }, session.name);

    revalidatePath("/admin/n8n-webhooks");
    return {
      success: true,
      message: `Webhook "${parsed.data.name}" angelegt.`,
      // Klartext-Key NUR hier zurueckgeben — danach nicht mehr einsehbar
      plainKey: key,
    };
  } catch (err) {
    console.error("createWebhookConfig:", err instanceof Error ? err.message : err);
    return { error: "Fehler beim Anlegen." };
  }
}

export async function toggleWebhookConfigAktivAction(formData: FormData) {
  const session = await requireAdmin();
  const id = safeFormNumber(formData, "id");
  const aktiv = formData.get("aktiv") === "true";
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await db
      .update(schema.webhookConfigs)
      .set({ aktiv, updatedAt: new Date() })
      .where(eq(schema.webhookConfigs.id, id));
    await writeAuditLog("webhook_configs", id, "UPDATE", null, { aktiv }, session.name);
    revalidatePath("/admin/n8n-webhooks");
    return { success: true, message: aktiv ? "Webhook aktiviert." : "Webhook deaktiviert." };
  } catch (err) {
    console.error(err);
    return { error: "Fehler beim Aendern." };
  }
}

export async function deleteWebhookConfigAction(formData: FormData) {
  const session = await requireAdmin();
  const id = safeFormNumber(formData, "id");
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await db.delete(schema.webhookConfigs).where(eq(schema.webhookConfigs.id, id));
    await writeAuditLog("webhook_configs", id, "DELETE", null, null, session.name);
    revalidatePath("/admin/n8n-webhooks");
    return { success: true, message: "Webhook geloescht." };
  } catch (err) {
    console.error(err);
    return { error: "Fehler beim Loeschen." };
  }
}

// ============================================================
// Ausgehende Notifications (notification_targets)
// ============================================================

export async function listNotificationTargets() {
  await requireAdmin();
  return db
    .select()
    .from(schema.notificationTargets)
    .orderBy(desc(schema.notificationTargets.createdAt));
}

const notificationTargetSchema = z.object({
  name: z.string().min(2, "Name muss mind. 2 Zeichen haben.").max(100),
  url: z.string().url("Gueltige URL erforderlich."),
  secret: z.string().max(200).optional(),
  eventTypes: z.array(z.string()).min(1, "Mind. 1 Event muss abonniert sein."),
  beschreibung: z.string().max(1000).optional(),
});

function parseEventTypesFromForm(formData: FormData): string[] {
  const all = formData.getAll("eventTypes").map((v) => String(v));
  return all.filter((e) => (ALL_EVENT_TYPES as string[]).includes(e));
}

export async function createNotificationTargetAction(formData: FormData) {
  const session = await requireAdmin();
  const parsed = notificationTargetSchema.safeParse({
    name: safeFormString(formData, "name", 100).trim(),
    url: safeFormString(formData, "url", 500).trim(),
    secret: safeFormString(formData, "secret", 200).trim() || undefined,
    eventTypes: parseEventTypesFromForm(formData),
    beschreibung: safeFormString(formData, "beschreibung", 1000).trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const urlCheck = await validateWebhookUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return { error: `URL abgelehnt: ${urlCheck.reason}` };
  }

  try {
    const [inserted] = await db
      .insert(schema.notificationTargets)
      .values({
        name: parsed.data.name,
        url: parsed.data.url,
        secret: parsed.data.secret ?? null,
        eventTypes: parsed.data.eventTypes,
        beschreibung: parsed.data.beschreibung ?? null,
        erstelltVon: session.name,
      })
      .returning();
    await writeAuditLog("notification_targets", inserted.id, "INSERT", null, parsed.data, session.name);
    revalidatePath("/admin/n8n-webhooks");
    return { success: true, message: `Ziel "${parsed.data.name}" angelegt.` };
  } catch (err) {
    console.error(err);
    return { error: "Fehler beim Anlegen." };
  }
}

export async function updateNotificationTargetAction(formData: FormData) {
  const session = await requireAdmin();
  const id = safeFormNumber(formData, "id");
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  const parsed = notificationTargetSchema.safeParse({
    name: safeFormString(formData, "name", 100).trim(),
    url: safeFormString(formData, "url", 500).trim(),
    secret: safeFormString(formData, "secret", 200).trim() || undefined,
    eventTypes: parseEventTypesFromForm(formData),
    beschreibung: safeFormString(formData, "beschreibung", 1000).trim() || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const urlCheck = await validateWebhookUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return { error: `URL abgelehnt: ${urlCheck.reason}` };
  }

  try {
    await db
      .update(schema.notificationTargets)
      .set({
        name: parsed.data.name,
        url: parsed.data.url,
        secret: parsed.data.secret ?? null,
        eventTypes: parsed.data.eventTypes,
        beschreibung: parsed.data.beschreibung ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationTargets.id, id));
    await writeAuditLog("notification_targets", id, "UPDATE", null, parsed.data, session.name);
    revalidatePath("/admin/n8n-webhooks");
    return { success: true, message: "Ziel aktualisiert." };
  } catch (err) {
    console.error(err);
    return { error: "Fehler beim Aktualisieren." };
  }
}

export async function toggleNotificationTargetAktivAction(formData: FormData) {
  const session = await requireAdmin();
  const id = safeFormNumber(formData, "id");
  const aktiv = formData.get("aktiv") === "true";
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await db
      .update(schema.notificationTargets)
      .set({ aktiv, updatedAt: new Date() })
      .where(eq(schema.notificationTargets.id, id));
    await writeAuditLog("notification_targets", id, "UPDATE", null, { aktiv }, session.name);
    revalidatePath("/admin/n8n-webhooks");
    return { success: true, message: aktiv ? "Ziel aktiviert." : "Ziel deaktiviert." };
  } catch (err) {
    console.error(err);
    return { error: "Fehler beim Aendern." };
  }
}

export async function deleteNotificationTargetAction(formData: FormData) {
  const session = await requireAdmin();
  const id = safeFormNumber(formData, "id");
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  try {
    await db.delete(schema.notificationTargets).where(eq(schema.notificationTargets.id, id));
    await writeAuditLog("notification_targets", id, "DELETE", null, null, session.name);
    revalidatePath("/admin/n8n-webhooks");
    return { success: true, message: "Ziel geloescht." };
  } catch (err) {
    console.error(err);
    return { error: "Fehler beim Loeschen." };
  }
}

export async function testNotificationTargetAction(formData: FormData) {
  await requireAdmin();
  const id = safeFormNumber(formData, "id");
  if (!Number.isFinite(id) || id <= 0) return { error: "Ungueltige ID." };

  const result = await sendTestNotification(id);
  if (result.success) {
    return {
      success: true,
      message: `Test erfolgreich (HTTP ${result.httpStatus}, ${result.durationMs}ms).`,
    };
  }
  return {
    error: `Test fehlgeschlagen${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ""}: ${result.error ?? "Unbekannt"}`,
  };
}

// ============================================================
// Logs
// ============================================================

export async function listRecentSyncLogs(limit = 50) {
  await requireAdmin();
  return db
    .select()
    .from(schema.deputatSyncLog)
    .orderBy(desc(schema.deputatSyncLog.syncDatum))
    .limit(limit);
}

export interface NotificationFilter {
  status?: "pending" | "success" | "failed";
  offset?: number;
  limit?: number;
}

export async function listRecentNotifications(filter: NotificationFilter = {}) {
  await requireAdmin();
  const limit = Math.min(Math.max(1, filter.limit ?? 100), 500);
  const offset = Math.max(0, filter.offset ?? 0);

  const conditions = filter.status
    ? [eq(schema.notificationLog.status, filter.status)]
    : [];

  const query = db
    .select({
      id: schema.notificationLog.id,
      targetId: schema.notificationLog.targetId,
      eventType: schema.notificationLog.eventType,
      status: schema.notificationLog.status,
      attemptCount: schema.notificationLog.attemptCount,
      lastError: schema.notificationLog.lastError,
      lastAttemptAt: schema.notificationLog.lastAttemptAt,
      nextRetryAt: schema.notificationLog.nextRetryAt,
      httpStatus: schema.notificationLog.httpStatus,
      createdAt: schema.notificationLog.createdAt,
      targetName: schema.notificationTargets.name,
    })
    .from(schema.notificationLog)
    .leftJoin(
      schema.notificationTargets,
      eq(schema.notificationLog.targetId, schema.notificationTargets.id)
    );

  const filtered = conditions.length > 0 ? query.where(and(...conditions)) : query;
  return filtered.orderBy(desc(schema.notificationLog.createdAt)).limit(limit).offset(offset);
}

/** Zaehler fuer Dashboard-Kacheln (letzte 30 Tage) */
export async function getWebhookStats() {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [configCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.webhookConfigs)
    .where(eq(schema.webhookConfigs.aktiv, true));

  const recentSyncs = await db
    .select({ status: schema.deputatSyncLog.status })
    .from(schema.deputatSyncLog)
    .where(gte(schema.deputatSyncLog.syncDatum, since));

  const recentNotifs = await db
    .select({ status: schema.notificationLog.status })
    .from(schema.notificationLog)
    .where(gte(schema.notificationLog.createdAt, since));

  return {
    aktiveKonfigs: Number(configCount?.c ?? 0),
    syncsGesamt: recentSyncs.length,
    syncsFehler: recentSyncs.filter((s) => s.status !== "success").length,
    notifsGesamt: recentNotifs.length,
    notifsFehler: recentNotifs.filter((n) => n.status === "failed").length,
    notifsPending: recentNotifs.filter((n) => n.status === "pending").length,
  };
}
