"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { statistikCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/permissions";
import { createStatistikCode, updateStatistikCode } from "@/lib/db/queries";
import {
  statistikCodeCreateSchema,
  statistikCodeUpdateSchema,
  safeFormString,
  safeFormNumber,
} from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

/** PostgreSQL-Errorcode aus Drizzle/postgres-js Fehler extrahieren. */
function pgErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return undefined;
}

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

function pathsToRevalidate() {
  revalidatePath("/einstellungen/statistik-codes");
  revalidatePath("/mitarbeiter");
  revalidatePath("/dashboard");
  revalidatePath("/deputate");
}

export async function createStatistikCodeAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = statistikCodeCreateSchema.safeParse({
    code: safeFormString(formData, "code", 5).trim().toUpperCase(),
    bezeichnung: safeFormString(formData, "bezeichnung", 150).trim(),
    gruppe: safeFormString(formData, "gruppe", 30),
    istTeilzeit: formData.get("istTeilzeit") === "true",
    sortierung: safeFormNumber(formData, "sortierung"),
    bemerkung: safeFormString(formData, "bemerkung", 1000).trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const data = parsed.data;

  try {
    const result = await createStatistikCode({
      code: data.code,
      bezeichnung: data.bezeichnung,
      gruppe: data.gruppe,
      istTeilzeit: data.istTeilzeit,
      sortierung: data.sortierung,
      bemerkung: data.bemerkung ?? null,
    });

    await writeAuditLog("statistik_codes", result.id, "INSERT", null, {
      code: data.code,
      bezeichnung: data.bezeichnung,
      gruppe: data.gruppe,
      istTeilzeit: data.istTeilzeit,
    }, session.name);

    pathsToRevalidate();
    return { success: true, message: `Code "${data.code}" angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen des Statistik-Codes:", err instanceof Error ? err.message : "Unbekannt");
    if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
      return { error: `Code "${data.code}" existiert bereits.` };
    }
    return { error: "Fehler beim Anlegen des Codes." };
  }
}

export async function updateStatistikCodeAction(formData: FormData) {
  const session = await requireAdmin();

  const code = safeFormString(formData, "code", 5).trim().toUpperCase();
  if (!code) return { error: "Code fehlt." };

  const parsed = statistikCodeUpdateSchema.safeParse({
    bezeichnung: safeFormString(formData, "bezeichnung", 150).trim(),
    gruppe: safeFormString(formData, "gruppe", 30),
    istTeilzeit: formData.get("istTeilzeit") === "true",
    sortierung: safeFormNumber(formData, "sortierung"),
    bemerkung: safeFormString(formData, "bemerkung", 1000).trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const data = parsed.data;

  try {
    // Vorher-Wert aus DB lesen fuer korrekten Audit-Trail
    const [before] = await db
      .select({
        bezeichnung: statistikCodes.bezeichnung,
        gruppe: statistikCodes.gruppe,
        istTeilzeit: statistikCodes.istTeilzeit,
        sortierung: statistikCodes.sortierung,
        bemerkung: statistikCodes.bemerkung,
      })
      .from(statistikCodes)
      .where(eq(statistikCodes.code, code));

    if (!before) return { error: "Code nicht gefunden." };

    const result = await updateStatistikCode(code, {
      bezeichnung: data.bezeichnung,
      gruppe: data.gruppe,
      istTeilzeit: data.istTeilzeit,
      sortierung: data.sortierung,
      bemerkung: data.bemerkung ?? null,
    });

    if (!result) return { error: "Code nicht gefunden." };

    await writeAuditLog("statistik_codes", result.id, "UPDATE", before, {
      code,
      bezeichnung: data.bezeichnung,
      gruppe: data.gruppe,
      istTeilzeit: data.istTeilzeit,
      sortierung: data.sortierung,
      bemerkung: data.bemerkung ?? null,
    }, session.name);

    pathsToRevalidate();
    return { success: true, message: `Code "${code}" aktualisiert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aktualisieren des Codes:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aktualisieren des Codes." };
  }
}

export async function toggleStatistikCodeAktivAction(formData: FormData) {
  const session = await requireAdmin();

  const code = safeFormString(formData, "code", 5).trim().toUpperCase();
  const aktiv = formData.get("aktiv") === "true";

  if (!code) return { error: "Code fehlt." };

  try {
    // Tatsaechlichen Vorher-Wert aus DB lesen
    const [before] = await db
      .select({ aktiv: statistikCodes.aktiv })
      .from(statistikCodes)
      .where(eq(statistikCodes.code, code));

    if (!before) return { error: "Code nicht gefunden." };

    const result = await updateStatistikCode(code, { aktiv });
    if (!result) return { error: "Code nicht gefunden." };

    await writeAuditLog("statistik_codes", result.id, "UPDATE", { aktiv: before.aktiv }, { aktiv }, session.name);

    pathsToRevalidate();
    return { success: true, message: aktiv ? `Code "${code}" aktiviert.` : `Code "${code}" deaktiviert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aendern des Status:", err instanceof Error ? err.message : "Unbekannt");
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) {
      return { error: `Code "${code}" wird verwendet und kann nicht geloescht werden.` };
    }
    return { error: "Fehler beim Aendern des Status." };
  }
}
