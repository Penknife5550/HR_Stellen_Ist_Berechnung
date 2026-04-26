"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createStatistikCode, updateStatistikCode } from "@/lib/db/queries";
import {
  statistikCodeCreateSchema,
  statistikCodeUpdateSchema,
  safeFormString,
} from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

export async function createStatistikCodeAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = statistikCodeCreateSchema.safeParse({
    code: safeFormString(formData, "code", 5).trim().toUpperCase(),
    bezeichnung: safeFormString(formData, "bezeichnung", 150).trim(),
    gruppe: safeFormString(formData, "gruppe", 30),
    istTeilzeit: formData.get("istTeilzeit") === "true",
    sortierung: Number(formData.get("sortierung") ?? 0),
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

    revalidatePath("/einstellungen/statistik-codes");
    revalidatePath("/mitarbeiter");
    revalidatePath("/dashboard");
    return { success: true, message: `Code "${data.code}" angelegt.` };
  } catch (err: unknown) {
    console.error("Fehler beim Anlegen des Statistik-Codes:", err instanceof Error ? err.message : "Unbekannt");
    if (err instanceof Error && err.message.includes("unique")) {
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
    sortierung: Number(formData.get("sortierung") ?? 0),
    bemerkung: safeFormString(formData, "bemerkung", 1000).trim() || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const data = parsed.data;

  try {
    const result = await updateStatistikCode(code, {
      bezeichnung: data.bezeichnung,
      gruppe: data.gruppe,
      istTeilzeit: data.istTeilzeit,
      sortierung: data.sortierung,
      bemerkung: data.bemerkung ?? null,
    });

    if (!result) return { error: "Code nicht gefunden." };

    await writeAuditLog("statistik_codes", result.id, "UPDATE", null, {
      code,
      bezeichnung: data.bezeichnung,
      gruppe: data.gruppe,
      istTeilzeit: data.istTeilzeit,
    }, session.name);

    revalidatePath("/einstellungen/statistik-codes");
    revalidatePath("/mitarbeiter");
    revalidatePath("/dashboard");
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
    const result = await updateStatistikCode(code, { aktiv });
    if (!result) return { error: "Code nicht gefunden." };

    await writeAuditLog("statistik_codes", result.id, "UPDATE", { aktiv: !aktiv }, { aktiv }, session.name);

    revalidatePath("/einstellungen/statistik-codes");
    revalidatePath("/mitarbeiter");
    revalidatePath("/dashboard");
    return { success: true, message: aktiv ? `Code "${code}" aktiviert.` : `Code "${code}" deaktiviert.` };
  } catch (err: unknown) {
    console.error("Fehler beim Aendern des Status:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Aendern des Status." };
  }
}
